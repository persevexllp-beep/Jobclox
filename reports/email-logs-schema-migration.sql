-- Email logs schema migration for Persevex Job Portal.
-- Generated after schema validation found public.email_logs missing.
-- Compatibility columns preserve the current EmailAlert API response shape.

create table if not exists public.email_logs (
  id text primary key,
  user_id text,
  recipient text not null,
  subject text not null,
  template text not null,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  recipient_name text,
  triggered_by_event text
);
