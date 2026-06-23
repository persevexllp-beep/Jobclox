-- Persevex-owned lead capture for external job applications.
-- Requires 20260622120000_hybrid_job_marketplace.sql.

create extension if not exists pg_trgm;

create table if not exists public.external_job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  candidate_id uuid not null references public.candidate_profiles(id) on delete restrict,
  candidate_name text not null,
  candidate_email text not null,
  candidate_phone text,
  resume_url text,
  resume_text text not null default '',
  skills text[] not null default '{}',
  experience text not null default '',
  source text not null,
  company_name text not null,
  job_title text not null,
  status text not null default 'new',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document text generated always as (
    lower(candidate_name || ' ' || candidate_email || ' ' || company_name || ' ' || job_title)
  ) stored,
  constraint external_job_applications_candidate_job_unique unique (candidate_id, job_id),
  constraint external_job_applications_status_check check (
    status in ('new', 'contacted', 'shared_with_company', 'interview_scheduled', 'rejected', 'placed')
  ),
  constraint external_job_applications_email_check check (position('@' in candidate_email) > 1)
);

create index if not exists external_job_applications_candidate_created_idx
  on public.external_job_applications (candidate_id, created_at desc);
create index if not exists external_job_applications_job_created_idx
  on public.external_job_applications (job_id, created_at desc);
create index if not exists external_job_applications_status_created_idx
  on public.external_job_applications (status, created_at desc);
create index if not exists external_job_applications_source_created_idx
  on public.external_job_applications (source, created_at desc);
create index if not exists external_job_applications_company_created_idx
  on public.external_job_applications (company_name, created_at desc);
create index if not exists external_job_applications_search_idx
  on public.external_job_applications using gin (search_document gin_trgm_ops);
create index if not exists external_job_applications_company_trgm_idx
  on public.external_job_applications using gin (company_name gin_trgm_ops);

create or replace function public.validate_external_job_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.jobs
    where id = new.job_id and is_external = true and is_active = true and status = 'approved'
  ) then
    raise exception 'external_job_applications requires an active approved external job';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_external_job_application_trigger on public.external_job_applications;
create trigger validate_external_job_application_trigger
before insert or update of job_id on public.external_job_applications
for each row execute function public.validate_external_job_application();

create or replace function public.set_external_job_application_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_external_job_application_updated_at_trigger on public.external_job_applications;
create trigger set_external_job_application_updated_at_trigger
before update on public.external_job_applications
for each row execute function public.set_external_job_application_updated_at();

alter table public.external_job_applications enable row level security;
revoke all on public.external_job_applications from anon, authenticated;
grant select, insert, update, delete on public.external_job_applications to service_role;

create or replace function public.get_external_job_application_analytics()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.external_job_applications),
    'byCompany', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', company_name, 'value', application_count)
        order by application_count desc
      )
      from (
        select company_name, count(*) as application_count
        from public.external_job_applications
        group by company_name
        order by application_count desc
        limit 20
      ) as company_groups
    ), '[]'::jsonb),
    'bySource', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', source, 'value', application_count)
        order by application_count desc
      )
      from (
        select source, count(*) as application_count
        from public.external_job_applications
        group by source
      ) as source_groups
    ), '[]'::jsonb),
    'byDay', coalesce((
      select jsonb_agg(
        jsonb_build_object('date', day_bucket::date, 'value', application_count)
        order by day_bucket
      )
      from (
        select
          date_trunc('day', created_at) as day_bucket,
          count(*) as application_count
        from public.external_job_applications
        where created_at >= now() - interval '30 days'
        group by date_trunc('day', created_at)
      ) as daily_groups
    ), '[]'::jsonb),
    'statusBreakdown', coalesce((
      select jsonb_agg(
        jsonb_build_object('status', status, 'value', application_count)
        order by case status
          when 'new' then 1
          when 'contacted' then 2
          when 'shared_with_company' then 3
          when 'interview_scheduled' then 4
          when 'placed' then 5
          when 'rejected' then 6
          else 7
        end
      )
      from (
        select status, count(*) as application_count
        from public.external_job_applications
        group by status
      ) as status_groups
    ), '[]'::jsonb),
    'topJobs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobId', job_id,
          'jobTitle', job_title,
          'companyName', company_name,
          'value', application_count
        )
        order by application_count desc
      )
      from (
        select
          job_id,
          max(job_title) as job_title,
          max(company_name) as company_name,
          count(*) as application_count
        from public.external_job_applications
        group by job_id
        order by application_count desc
        limit 20
      ) as job_groups
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_external_job_application_analytics() from public;
grant execute on function public.get_external_job_application_analytics() to service_role;

comment on table public.external_job_applications is
  'Candidate-owned external job leads reviewed and exported only by Persevex admins';
