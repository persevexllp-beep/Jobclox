-- Hybrid internal/external job marketplace foundation.
-- Apply before deploying code that reads external job metadata.

create extension if not exists pg_trgm;

alter table public.jobs
  add column if not exists is_external boolean not null default false,
  add column if not exists source text not null default 'internal',
  add column if not exists source_job_id text,
  add column if not exists source_url text,
  add column if not exists external_apply_url text,
  add column if not exists imported_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists job_fingerprint text,
  add column if not exists is_active boolean not null default true,
  add column if not exists normalized_skills text[] not null default '{}',
  add column if not exists search_vector tsvector generated always as (
    to_tsvector('english'::regconfig,
      coalesce(title, '') || ' ' || coalesce(company_name, '') || ' ' ||
      coalesce(location, '') || ' ' || coalesce(description, '')
    )
  ) stored;

update public.jobs
set is_external = false,
    source = 'internal',
    is_active = true,
    normalized_skills = array(
      select lower(trim(skill))
      from unnest(coalesce(requirements, '{}'::text[]) || coalesce(preferred_skills, '{}'::text[])) skill
      where trim(skill) <> ''
    )
where is_external is distinct from false
   or source is distinct from 'internal'
   or is_active is distinct from true
   or normalized_skills = '{}'::text[];

alter table public.jobs
  drop constraint if exists jobs_source_shape_check,
  add constraint jobs_source_shape_check check (
    (is_external = false and source = 'internal' and source_job_id is null)
    or
    (is_external = true and source <> 'internal' and source_job_id is not null
      and external_apply_url is not null and job_fingerprint is not null)
  );

create unique index if not exists jobs_external_source_id_unique
  on public.jobs (source, source_job_id);

create unique index if not exists jobs_external_fingerprint_unique
  on public.jobs (job_fingerprint);

create index if not exists jobs_marketplace_rank_idx
  on public.jobs (is_active, status, visibility, is_external, featured desc, created_at desc);

create index if not exists jobs_external_last_seen_idx
  on public.jobs (last_seen_at)
  where is_external = true and is_active = true;

create index if not exists jobs_source_imported_idx
  on public.jobs (source, imported_at desc)
  where is_external = true;

create index if not exists jobs_normalized_skills_gin_idx
  on public.jobs using gin (normalized_skills);

create index if not exists jobs_search_vector_idx
  on public.jobs using gin (search_vector);

create index if not exists jobs_title_company_trgm_idx
  on public.jobs using gin ((lower(coalesce(title, '') || ' ' || coalesce(company_name, ''))) gin_trgm_ops);

create table if not exists public.saved_jobs (
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, job_id)
);

create index if not exists saved_jobs_candidate_created_idx
  on public.saved_jobs (candidate_id, created_at desc);

alter table public.saved_jobs enable row level security;
revoke all on public.saved_jobs from anon, authenticated;
grant select, insert, update, delete on public.saved_jobs to service_role;

create table if not exists public.job_provider_syncs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  deactivated_count integer not null default 0,
  duration_ms integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists job_provider_syncs_provider_started_idx
  on public.job_provider_syncs (provider, started_at desc);

alter table public.job_provider_syncs enable row level security;
revoke all on public.job_provider_syncs from anon, authenticated;
grant select, insert, update, delete on public.job_provider_syncs to service_role;

create or replace function public.increment_job_view(job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.jobs
  set view_count = coalesce(view_count, 0) + 1
  where id = job_id and is_active = true;
$$;

revoke all on function public.increment_job_view(uuid) from public;
grant execute on function public.increment_job_view(uuid) to service_role;

create or replace function public.get_job_source_analytics()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totalJobs', count(*),
    'internalJobs', count(*) filter (where is_external = false),
    'externalJobs', count(*) filter (where is_external = true),
    'activeJobs', count(*) filter (where is_active = true),
    'staleJobs', count(*) filter (where is_external = true and is_active = false),
    'importedToday', count(*) filter (where is_external = true and imported_at >= date_trunc('day', now())),
    'importedThisWeek', count(*) filter (where is_external = true and imported_at >= date_trunc('week', now())),
    'bySource', coalesce((
      select jsonb_object_agg(source, source_count)
      from (select source, count(*) as source_count from public.jobs group by source) grouped
    ), '{}'::jsonb)
  )
  from public.jobs;
$$;

revoke all on function public.get_job_source_analytics() from public;
grant execute on function public.get_job_source_analytics() to service_role;

create or replace function public.get_admin_analytics()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with
  company_metrics as (
    select count(*) as total,
      count(*) filter (where verification_status = 'approved') as verified,
      count(*) filter (where verification_status = 'pending') as pending
    from public.companies
  ),
  job_metrics as (
    select count(*) as total,
      count(*) filter (where status = 'submitted') as pending,
      count(*) filter (where status = 'approved') as approved
    from public.jobs
  ),
  application_metrics as (
    select count(*) as total,
      count(*) filter (where status = 'forwarded') as forwarded,
      count(*) filter (where status = 'interviewing') as interviewing,
      count(*) filter (where status = 'selected' or final_result = 'hired') as selected
    from public.applications
  ),
  month_series as (
    select generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') month_start
  ),
  application_trend as (
    select to_char(m.month_start, 'Mon') as month,
      count(a.id) as applications,
      count(a.id) filter (where a.status = 'forwarded') as forwarded
    from month_series m
    left join public.applications a on a.created_at >= m.month_start and a.created_at < m.month_start + interval '1 month'
    group by m.month_start order by m.month_start
  ),
  job_type_trend as (
    select job_type as name, count(*) as value from public.jobs group by job_type order by value desc
  ),
  company_ranking as (
    select c.company_name as name,
      count(j.id) filter (where j.is_external = false) as jobs,
      c.verification_status = 'approved' as verified
    from public.companies c
    left join public.jobs j on j.company_id = c.id
    group by c.id, c.company_name, c.verification_status
    order by jobs desc limit 20
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalCompanies', cm.total, 'verifiedCompanies', cm.verified, 'pendingVerifications', cm.pending,
      'totalJobs', jm.total, 'pendingJobs', jm.pending, 'approvedJobs', jm.approved,
      'totalApplications', am.total, 'forwardedApplications', am.forwarded,
      'interviewingApps', am.interviewing, 'selectedApps', am.selected
    ),
    'appsTrend', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from application_trend t),
    'jobsTrend', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from job_type_trend t),
    'topCompanies', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from company_ranking t)
  )
  from company_metrics cm cross join job_metrics jm cross join application_metrics am;
$$;

revoke all on function public.get_admin_analytics() from public;
grant execute on function public.get_admin_analytics() to service_role;

comment on column public.jobs.job_fingerprint is
  'SHA-256 of normalized title, company, and location for external deduplication';
comment on table public.job_provider_syncs is
  'Operational history for external job provider sync attempts';
comment on table public.saved_jobs is
  'Candidate-owned persistent marketplace bookmarks accessed through guarded application APIs';
