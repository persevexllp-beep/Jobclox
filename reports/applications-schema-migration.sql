-- Applications required columns migration for Persevex Job Portal
-- Schema verification on 2026-06-09 found all columns below missing.
-- This file intentionally does not create indexes.
-- Apply this first, then re-run schema verification before code migration.

alter table public.applications
  add column if not exists candidate_name text,
  add column if not exists candidate_email text,
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists company_name text,
  add column if not exists job_title text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists matched_skills text[] not null default '{}',
  add column if not exists missing_skills text[] not null default '{}',
  add column if not exists interview_date text,
  add column if not exists final_result text,
  add column if not exists rejection_reason text;
