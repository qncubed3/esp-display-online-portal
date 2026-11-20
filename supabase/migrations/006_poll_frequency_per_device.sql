-- 006: poll frequency is set per Device, not per Service.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe whether or not 005 was run.
alter table public.devices
  add column if not exists poll_seconds integer not null default 30
  check (poll_seconds between 15 and 3600);

alter table public.services drop column if exists poll_seconds;
