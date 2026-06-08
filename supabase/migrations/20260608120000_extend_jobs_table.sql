-- Extends jobs table to match the application Job interface.
-- Apply BEFORE Jobs module migration (Step 2 schema validation).
-- Verified against live schema: jobs table exists with id, company_id, title,
-- department, location, description, requirements, status, created_at.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'Full-time',
  ADD COLUMN IF NOT EXISTS experience text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS salary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deadline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Optional: ensure requirements uses text[] if currently untyped/nullable
-- ALTER TABLE public.jobs ALTER COLUMN requirements SET DEFAULT '{}';

COMMENT ON COLUMN public.jobs.company_name IS 'Denormalized company display name for API responses';
COMMENT ON COLUMN public.jobs.job_type IS 'Full-time | Part-time | Contract | Internship';
COMMENT ON COLUMN public.jobs.view_count IS 'Candidate listing view counter';
