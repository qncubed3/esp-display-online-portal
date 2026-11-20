-- 002: share Services with other users, and log device polls for stats.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- ── Sharing ────────────────────────────────────────────────────────────────
-- The creator (services.owner_id) is the owner. Members can view and edit the
-- Service and its Devices; only the owner can delete it or manage members.
create table public.service_members (
  service_id uuid not null references public.services (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text not null,          -- the invited email, for showing in the member list
  added_by   uuid references auth.users (id) on delete set null,
  seen_at    timestamptz,            -- null = unread notification for the member
  created_at timestamptz not null default now(),
  primary key (service_id, user_id)
);
create index on public.service_members (user_id);

-- Helpers are security definer so policies on services and service_members
-- can refer to each other without recursion.
create function public.owns_service(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from services where id = sid and owner_id = auth.uid());
$$;

create function public.can_access_service(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from services where id = sid and owner_id = auth.uid())
      or exists (select 1 from service_members where service_id = sid and user_id = auth.uid());
$$;

-- Server-only: look up a user by email when inviting. Not callable from the browser.
create function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- Replace the owner-only policies with owner-or-member ones.
drop policy if exists "own services" on public.services;
drop policy if exists "own devices" on public.devices;

create policy "services: read" on public.services
  for select to authenticated using (public.can_access_service(id));
create policy "services: create" on public.services
  for insert to authenticated with check (owner_id = auth.uid());
create policy "services: edit" on public.services
  for update to authenticated using (public.can_access_service(id)) with check (public.can_access_service(id));
create policy "services: delete" on public.services
  for delete to authenticated using (owner_id = auth.uid());

create policy "devices: all" on public.devices
  for all to authenticated
  using (public.can_access_service(service_id))
  with check (public.can_access_service(service_id));

alter table public.service_members enable row level security;

-- Owners see and manage their Service's members; members see their own rows.
create policy "members: read" on public.service_members
  for select to authenticated using (user_id = auth.uid() or public.owns_service(service_id));
create policy "members: add" on public.service_members
  for insert to authenticated with check (public.owns_service(service_id));
create policy "members: remove" on public.service_members
  for delete to authenticated using (public.owns_service(service_id) or user_id = auth.uid());
create policy "members: mark seen" on public.service_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Poll log ───────────────────────────────────────────────────────────────
-- One row per device request to /api/device/frame. Written by the server with
-- the secret key; readable by anyone who can access the Service.
create table public.device_polls (
  id          bigint generated always as identity primary key,
  device_id   uuid not null references public.devices (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  at          timestamptz not null default now(),
  status      smallint not null,     -- HTTP status sent: 200, 204, 304, 500
  duration_ms integer not null,      -- total server time for the request
  data_ms     integer,               -- time spent running the Data section
  bytes       integer,               -- response body size
  ops         integer,               -- draw commands sent
  error       text,                  -- Data section error, if any
  ip          text,
  rssi        smallint,              -- WiFi signal, if the device sends X-RSSI
  heap        integer,               -- free heap bytes, if the device sends X-Heap
  uptime_s    integer,               -- device uptime, if the device sends X-Uptime
  fw          text                   -- firmware version, if the device sends X-FW
);
create index on public.device_polls (service_id, at desc);
create index on public.device_polls (device_id, at desc);

alter table public.device_polls enable row level security;
create policy "polls: read" on public.device_polls
  for select to authenticated using (public.can_access_service(service_id));
