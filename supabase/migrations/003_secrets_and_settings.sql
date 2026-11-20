-- 003: per-user API secrets and settings.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Secrets: named values (API keys) a user's Data code reads as secrets.NAME.
-- A Service's Data code gets its OWNER's secrets, so members of a shared
-- Service use them without being able to read them.
create table public.user_secrets (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (name ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, name)
);

alter table public.user_secrets enable row level security;
create policy "secrets: own" on public.user_secrets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Settings: one row per user, created on first save.
-- timezone is the IANA zone used by now() in that user's Services' Data code.
create table public.user_settings (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  timezone   text not null default 'Australia/Melbourne',
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy "settings: own" on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
