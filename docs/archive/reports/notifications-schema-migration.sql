-- Notifications schema migration for Persevex Job Portal.
-- Generated after schema validation found public.notifications missing.
-- user_id is text to preserve the existing "all_admin" broadcast recipient.

create table if not exists public.notifications (
  id text primary key,
  recipient_id text not null,
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
