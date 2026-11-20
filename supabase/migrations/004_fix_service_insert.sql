-- 004: fix "new row violates row-level security policy for table services" when creating a Service.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- insert ... returning (used by supabase-js .insert().select()) checks the SELECT policy against the
-- new row. 002's policies only called can_access_service(id), which looks the row up in the table;
-- mid-insert the new row isn't visible to that lookup, so the check failed. Testing owner_id on the
-- row itself first needs no lookup.

drop policy if exists "services: read" on public.services;
create policy "services: read" on public.services
  for select to authenticated
  using (owner_id = auth.uid() or public.can_access_service(id));

drop policy if exists "services: edit" on public.services;
create policy "services: edit" on public.services
  for update to authenticated
  using (owner_id = auth.uid() or public.can_access_service(id))
  with check (owner_id = auth.uid() or public.can_access_service(id));
