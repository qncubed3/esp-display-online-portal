-- 010: the AI assistant's chat, saved per Service and shared by everyone with access to it.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- One row per message, append-only, so two people chatting at once never overwrite each other.
-- Anyone who can open the Service (owner or member) can read the chat, add to it and clear it.

create table if not exists public.ai_chat_messages (
  id           bigint generated always as identity primary key,
  service_id   uuid not null references public.services(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_email text,                          -- shown next to the user's messages
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  changed      jsonb,                         -- assistant replies: {"data": bool, "draw": bool}
  created_at   timestamptz not null default now()
);

create index if not exists ai_chat_messages_service on public.ai_chat_messages (service_id, id);

alter table public.ai_chat_messages enable row level security;

drop policy if exists "ai chat: read" on public.ai_chat_messages;
create policy "ai chat: read" on public.ai_chat_messages
  for select to authenticated using (public.can_access_service(service_id));

drop policy if exists "ai chat: add" on public.ai_chat_messages;
create policy "ai chat: add" on public.ai_chat_messages
  for insert to authenticated with check (user_id = auth.uid() and public.can_access_service(service_id));

drop policy if exists "ai chat: clear" on public.ai_chat_messages;
create policy "ai chat: clear" on public.ai_chat_messages
  for delete to authenticated using (public.can_access_service(service_id));

revoke all on public.ai_chat_messages from anon, authenticated;
grant select, insert, delete on public.ai_chat_messages to authenticated;
