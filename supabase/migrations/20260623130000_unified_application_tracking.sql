alter table public.applications
  add column if not exists source text not null default 'INTERNAL',
  add column if not exists external_job_id text,
  add column if not exists external_application_id uuid references public.external_job_applications(id) on delete set null,
  add column if not exists resume_used text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.applications
  drop constraint if exists applications_source_check;

alter table public.applications
  add constraint applications_source_check
  check (source in ('INTERNAL', 'JSEARCH', 'EXTERNAL', 'PARTNER'));

create index if not exists applications_candidate_source_created_idx
  on public.applications (candidate_id, source, created_at desc);

create index if not exists applications_external_job_id_idx
  on public.applications (external_job_id)
  where external_job_id is not null;

create unique index if not exists applications_candidate_external_job_unique_idx
  on public.applications (candidate_id, external_job_id)
  where external_job_id is not null;
