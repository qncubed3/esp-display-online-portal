import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationData, NotificationKind } from "./messages";

export type { NotificationData, NotificationKind } from "./messages";

// Every notification goes through here: one row in the notifications table (migration 009), which
// the top-bar bell reads. Written with the secret key, since users can't insert rows.
// Callers pass only users other than the one who made the change.

// Never throws: a missing table (migration 009 not run) or a failed insert must not undo the
// change that triggered the notification.
export async function notify<K extends NotificationKind>(userId: string, kind: K, data: NotificationData[K]): Promise<void> {
  try {
    const { error } = await createAdminClient().from("notifications").insert({ user_id: userId, kind, data });
    if (error) console.warn(`notify(${kind}) failed: ${error.message}`);
  } catch (e) {
    console.warn(`notify(${kind}) failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
/** notify() for several users at once, skipping duplicates and the user who made the change. */
export async function notifyMany<K extends NotificationKind>(
  userIds: Iterable<string | null | undefined>,
  actorId: string,
  kind: K,
  data: NotificationData[K] | ((userId: string) => NotificationData[K]),
): Promise<void> {
  const ids = [...new Set(userIds)].filter((id): id is string => !!id && id !== actorId);
  await Promise.all(ids.map((id) => notify(id, kind, typeof data === "function" ? data(id) : data)));
}
