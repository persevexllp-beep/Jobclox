-- Applications indexes required before code migration.
-- Apply after required columns are verified.

create index if not exists idx_applications_candidate_id
  on public.applications(candidate_id);

create index if not exists idx_applications_company_id
  on public.applications(company_id);

create index if not exists idx_applications_job_id
  on public.applications(job_id);

create index if not exists idx_applications_status
  on public.applications(status);
