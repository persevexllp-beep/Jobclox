-- Extends companies table to match the application Company interface.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS linkedin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_person text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb;
