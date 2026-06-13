-- Persevex live database compatibility and hardening.
-- Aligns the deployed Supabase schema with the Supabase-only backend.

alter table public.users
  add column if not exists password_hash text;

alter table public.companies
  add column if not exists linkedin text not null default '',
  add column if not exists company_email text not null default '',
  add column if not exists contact_person text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists documents jsonb not null default '[]'::jsonb;

alter table public.jobs
  add column if not exists company_name text not null default '',
  add column if not exists job_type text not null default 'Full-time',
  add column if not exists experience text not null default '',
  add column if not exists salary text not null default '',
  add column if not exists preferred_skills text[] not null default '{}',
  add column if not exists deadline text not null default '',
  add column if not exists view_count integer not null default 0;

update public.jobs j
set company_name = coalesce(nullif(j.company_name, ''), c.company_name)
from public.companies c
where j.company_id = c.id
  and coalesce(j.company_name, '') = '';

-- The backend writes applications.candidate_id with candidate_profiles.id.
-- Make the FK match the runtime contract.
do $$
declare
  existing_fk_name text;
begin
  select conname
    into existing_fk_name
  from pg_constraint
  where conrelid = 'public.applications'::regclass
    and contype = 'f'
    and conkey = array[
      (select attnum from pg_attribute where attrelid = 'public.applications'::regclass and attname = 'candidate_id')
    ];

  if existing_fk_name is not null then
    execute format('alter table public.applications drop constraint %I', existing_fk_name);
  end if;
end $$;

alter table public.applications
  add constraint applications_candidate_id_fkey
  foreign key (candidate_id)
  references public.candidate_profiles(id)
  on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_role_check'
  ) then
    alter table public.users
      add constraint users_role_check
      check (role in ('candidate', 'company', 'admin'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.companies'::regclass
      and conname = 'companies_verification_status_check'
  ) then
    alter table public.companies
      add constraint companies_verification_status_check
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_status_check'
  ) then
    alter table public.jobs
      add constraint jobs_status_check
      check (status in ('draft', 'submitted', 'approved', 'rejected', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_status_check'
  ) then
    alter table public.applications
      add constraint applications_status_check
      check (status in ('applied', 'under_review', 'shortlisted', 'forwarded', 'interviewing', 'selected', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_status_check'
  ) then
    alter table public.users
      add constraint users_status_check
      check (status in ('active', 'inactive'));
  end if;
end $$;

create unique index if not exists users_email_lower_unique
  on public.users (lower(email));

create unique index if not exists candidate_profiles_user_id_unique
  on public.candidate_profiles (user_id);

create unique index if not exists applications_candidate_job_unique
  on public.applications (candidate_id, job_id);

create index if not exists companies_user_id_idx
  on public.companies (user_id);

create index if not exists jobs_company_id_idx
  on public.jobs (company_id);

create index if not exists jobs_status_created_at_idx
  on public.jobs (status, created_at desc);

create index if not exists jobs_location_idx
  on public.jobs (location);

create index if not exists jobs_job_type_idx
  on public.jobs (job_type);

create index if not exists applications_candidate_id_idx
  on public.applications (candidate_id);

create index if not exists applications_company_id_idx
  on public.applications (company_id);

create index if not exists applications_job_id_idx
  on public.applications (job_id);

create index if not exists applications_status_idx
  on public.applications (status);

create index if not exists applications_company_status_created_idx
  on public.applications (company_id, status, created_at desc);

create index if not exists notifications_recipient_id_idx
  on public.notifications (recipient_id);

create index if not exists notifications_is_read_idx
  on public.notifications (is_read);

create index if not exists notifications_recipient_read_created_idx
  on public.notifications (recipient_id, is_read, created_at desc);

create index if not exists email_logs_user_id_idx
  on public.email_logs (user_id);

create index if not exists email_logs_recipient_created_idx
  on public.email_logs (recipient, created_at desc);

create index if not exists email_logs_created_at_idx
  on public.email_logs (created_at desc);
