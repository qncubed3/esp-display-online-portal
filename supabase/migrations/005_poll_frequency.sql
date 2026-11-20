-- 005: per-Service poll frequency (seconds between device polls), set from the Devices section.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
alter table public.services
  add column poll_seconds integer not null default 30
  check (poll_seconds between 15 and 3600);
