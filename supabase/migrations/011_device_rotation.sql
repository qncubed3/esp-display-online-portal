-- 011: per-device screen orientation, for a display mounted upside down.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- The values are TFT_eSPI's setRotation(): 1 = landscape (the default), 3 = landscape turned 180°.
-- Sent to the device in v2 frames (firmware 2.0+); devices on 1.x firmware ignore it.
-- devices updates aren't column-restricted (008 only limits services and service_members), and the
-- "devices: edit" policy already lets an owner update their own devices, so no grant is needed.

alter table public.devices
  add column if not exists rotation smallint not null default 1
  check (rotation in (1, 3));
