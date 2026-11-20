-- ESP Display Portal: database setup.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Users sign in with email + password. Create them by hand (Authentication → Users → Add user)
-- and turn off sign-ups, so only those users exist.

-- A Service: a screen definition that Devices subscribe to.
create table public.services (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  enabled    boolean not null default true,
  data_code  text not null default '',   -- Data section (JS)
  draw_ops   jsonb not null default '[]', -- Draw section: [{ id, op, args }] rows from the editor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A Device: one ESP32. Its key is shown once; only the SHA-256 hex hash is stored.
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references public.services (id) on delete cascade,
  name         text not null,
  key_hash     text not null unique,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

create index on public.services (owner_id);
create index on public.devices (service_id);

-- Row level security: signed-in users see only their own Services and Devices.
-- The device poll endpoint uses the secret key on the server, which bypasses RLS.
alter table public.services enable row level security;
alter table public.devices enable row level security;

create policy "own services" on public.services
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "own devices" on public.devices
  for all to authenticated
  using (exists (select 1 from public.services s where s.id = service_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.services s where s.id = service_id and s.owner_id = auth.uid()));
