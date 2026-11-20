-- 010: Web Push subscriptions, one row per browser that turned on push notifications in Settings.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- The server (secret key) reads these to send pushes and deletes ones the push service reports
-- as gone. Users can add, see and remove only their own.

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,   -- the browser's push service URL
  p256dh     text not null,          -- browser's public key (payload encryption)
  auth       text not null,          -- browser's auth secret
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: read own" on public.push_subscriptions;
create policy "push: read own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push: add own" on public.push_subscriptions;
create policy "push: add own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push: remove own" on public.push_subscriptions;
create policy "push: remove own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
