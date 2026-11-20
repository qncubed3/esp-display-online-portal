-- 008: limit which columns signed-in users can UPDATE.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- The UPDATE policies check who may update a row, not which columns change:
-- - "services: edit" let a member set services.owner_id to themselves (taking the Service over),
--   or an owner hand a Service (and its Data code) to another user, whose secrets it then runs with.
-- - "members: mark seen" let a member point their service_members row at any other service_id,
--   giving them access to that Service.
-- Column privileges close both: only the columns the portal actually updates stay writable.

revoke update on public.services from authenticated;
grant update (name, enabled, data_code, draw_ops, updated_at) on public.services to authenticated;

revoke update on public.service_members from authenticated;
grant update (seen_at) on public.service_members to authenticated;
