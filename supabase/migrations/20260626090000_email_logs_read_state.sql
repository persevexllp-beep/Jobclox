alter table public.email_logs
  add column if not exists is_read boolean not null default false;

create index if not exists email_logs_recipient_is_read_created_idx
  on public.email_logs (recipient, is_read, created_at desc);
