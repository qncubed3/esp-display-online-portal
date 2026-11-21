import "server-only";
import type { createClient } from "@/lib/supabase/server";

// The AI chat saved per Service (migration 010), shared by everyone with access to it. Every call
// uses the signed-in user's client, so RLS decides who can read, add to or clear a chat. If the
// table doesn't exist yet, loads return an empty chat and saves are skipped (logged).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SavedMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  changed: { data: boolean; draw: boolean } | null;
  /** Who sent a user message; null for assistant replies. */
  author: string | null;
  /** Sent by the signed-in user. */
  mine: boolean;
  createdAt: string;
}

const HISTORY_LIMIT = 200;

export async function loadChat(supabase: Supabase, serviceId: string, userId: string): Promise<SavedMessage[]> {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("id, user_id, author_email, role, content, changed, created_at")
    .eq("service_id", serviceId)
    .order("id", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    console.warn(`AI chat history not loaded (run migration 010?): ${error.message}`);
    return [];
  }
  type Row = {
    id: number;
    user_id: string;
    author_email: string | null;
    role: "user" | "assistant";
    content: string;
    changed: { data: boolean; draw: boolean } | null;
    created_at: string;
  };
  return ((data ?? []) as Row[]).reverse().map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    changed: r.changed,
    author: r.role === "user" ? r.author_email : null,
    mine: r.user_id === userId,
    createdAt: r.created_at,
  }));
}

// Never throws: a failed save must not fail the chat request.
export async function saveMessage(
  supabase: Supabase,
  message: {
    serviceId: string;
    role: "user" | "assistant";
    content: string;
    authorEmail?: string | null;
    changed?: { data: boolean; draw: boolean } | null;
  },
): Promise<void> {
  const { error } = await supabase.from("ai_chat_messages").insert({
    service_id: message.serviceId,
    role: message.role,
    content: message.content,
    author_email: message.authorEmail ?? null,
    changed: message.changed ?? null,
  });
  if (error) console.warn(`AI chat message not saved (run migration 010?): ${error.message}`);
}

export async function clearChat(supabase: Supabase, serviceId: string): Promise<string | null> {
  const { error } = await supabase.from("ai_chat_messages").delete().eq("service_id", serviceId);
  return error ? error.message : null;
}
