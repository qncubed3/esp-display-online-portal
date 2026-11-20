-- 009: general notifications, first used for device ownership transfers.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- "You were added to a Service" notifications still come from service_members.seen_at; this
-- table holds the rest. Rows are written only by the server (secret key); users can read their
-- own and mark them seen.

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,                       -- e.g. 'device_transferred'
  data       jsonb not null default '{}'::jsonb,  -- kind-specific details shown in the bell
  created_at timestamptz not null default now(),
  seen_at    timestamptz                          -- null = unread
);

create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications: mark seen" on public.notifications;
create policy "notifications: mark seen" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (seen_at) on public.notifications to authenticated;
