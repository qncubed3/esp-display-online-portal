-- 007: devices belong to users, not Services. A device subscribes to at most one Service and can be
-- moved to another (or none) from the portal without reflashing: its key stays the same.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- Owner: whoever owned the device's Service until now.
alter table public.devices add column owner_id uuid references auth.users (id) on delete cascade;
update public.devices d set owner_id = s.owner_id from public.services s where s.id = d.service_id;
alter table public.devices alter column owner_id set not null;
alter table public.devices alter column owner_id set default auth.uid();
create index on public.devices (owner_id);

-- Subscription: optional, and deleting a Service unsubscribes its devices instead of deleting them.
alter table public.devices alter column service_id drop not null;
alter table public.devices drop constraint devices_service_id_fkey;
alter table public.devices
  add constraint devices_service_id_fkey foreign key (service_id) references public.services (id) on delete set null;

-- Polls from a device with no Service are still logged.
alter table public.device_polls alter column service_id drop not null;
alter table public.device_polls drop constraint device_polls_service_id_fkey;
alter table public.device_polls
  add constraint device_polls_service_id_fkey foreign key (service_id) references public.services (id) on delete set null;

-- Devices: owners manage their own; people with access to a Service can see the devices on it.
-- A device can only be subscribed to a Service its owner can access.
drop policy if exists "devices: all" on public.devices;
drop policy if exists "own devices" on public.devices;

create policy "devices: read" on public.devices
  for select to authenticated
  using (owner_id = auth.uid() or (service_id is not null and public.can_access_service(service_id)));
create policy "devices: create" on public.devices
  for insert to authenticated
  with check (owner_id = auth.uid() and (service_id is null or public.can_access_service(service_id)));
create policy "devices: edit" on public.devices
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (service_id is null or public.can_access_service(service_id)));
create policy "devices: delete" on public.devices
  for delete to authenticated
  using (owner_id = auth.uid());

-- Polls: visible to the device's owner, and to anyone with access to the Service polled.
drop policy if exists "polls: read" on public.device_polls;
create policy "polls: read" on public.device_polls
  for select to authenticated
  using (
    (service_id is not null and public.can_access_service(service_id))
    or exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid())
  );
