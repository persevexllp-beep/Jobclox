-- Notifications schema correction for Persevex Job Portal.
-- Schema verification found public.notifications.user_id exists but required
-- public.notifications.recipient_id is missing.
-- This preserves existing data and keeps "all_admin" recipient support.

alter table public.notifications
  rename column user_id to recipient_id;
