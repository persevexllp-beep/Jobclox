-- Extends candidate_profiles to match the application CandidateProfile interface.
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS resume_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS resume_file_name text NOT NULL DEFAULT '';
