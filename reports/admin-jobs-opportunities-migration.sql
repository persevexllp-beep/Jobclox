-- Production Sprint 2: Admin job management + opportunity feed metadata.
-- Apply this in Supabase before relying on featured/sponsored/priority ranking
-- or expanded lifecycle states such as paused, archived, flagged, and suspended.

alter table public.jobs
  add column if not exists work_mode text,
  add column if not exists education text,
  add column if not exists benefits text,
  add column if not exists equity text,
  add column if not exists openings integer not null default 1,
  add column if not exists hiring_manager text,
  add column if not exists visibility text not null default 'public',
  add column if not exists featured boolean not null default false,
  add column if not exists sponsored boolean not null default false,
  add column if not exists priority boolean not null default false,
  add column if not exists moderation_reason text,
  add column if not exists updated_at timestamptz not null default now();

update public.jobs
set
  work_mode = coalesce(work_mode, case when lower(coalesce(location, '')) like '%remote%' then 'remote' else 'onsite' end),
  education = coalesce(education, ''),
  benefits = coalesce(benefits, ''),
  equity = coalesce(equity, ''),
  hiring_manager = coalesce(hiring_manager, ''),
  moderation_reason = coalesce(moderation_reason, ''),
  updated_at = coalesce(updated_at, created_at, now())
where true;

do $$
declare
  check_record record;
begin
  for check_record in
    select conname
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.jobs drop constraint if exists %I', check_record.conname);
  end loop;
end $$;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'paused', 'closed', 'archived', 'flagged', 'suspended'));

alter table public.jobs
  drop constraint if exists jobs_work_mode_check,
  add constraint jobs_work_mode_check check (work_mode is null or work_mode in ('remote', 'hybrid', 'onsite'));

alter table public.jobs
  drop constraint if exists jobs_visibility_check,
  add constraint jobs_visibility_check check (visibility in ('public', 'private'));

alter table public.jobs
  drop constraint if exists jobs_openings_positive_check,
  add constraint jobs_openings_positive_check check (openings > 0);

create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_company_id_idx on public.jobs(company_id);
create index if not exists jobs_job_type_idx on public.jobs(job_type);
create index if not exists jobs_deadline_idx on public.jobs(deadline);
create index if not exists jobs_visibility_status_idx on public.jobs(visibility, status);
create index if not exists jobs_promotion_idx on public.jobs(featured, sponsored, priority);

create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_jobs_updated_at();
