import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Every notification goes through here: one row in the notifications table (migration 009),
// which the top-bar bell reads. Written with the secret key, since users can't insert rows.

export type NotificationKind = "device_transferred";

export interface NotificationData {
  device_transferred: { device_id: string; device_name: string; from_email: string };
}

// Never throws: a missing table (migration 009 not run) or a failed insert must not undo the
// change that triggered the notification.
export async function notify<K extends NotificationKind>(userId: string, kind: K, data: NotificationData[K]): Promise<void> {
  const { error } = await createAdminClient().from("notifications").insert({ user_id: userId, kind, data });
  if (error) console.warn(`notify(${kind}) failed: ${error.message}`);
}
