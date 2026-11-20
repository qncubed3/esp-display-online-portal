import "server-only";
import { sendNotification, type PushSubscription, type WebPushError } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeNotification, type NotificationData, type NotificationKind } from "./messages";

export type { NotificationData, NotificationKind } from "./messages";

// Every notification goes through here: one row in the notifications table (migration 009), which
// the top-bar bell reads, plus a Web Push to each browser the user turned push on in (migration 010).
// Written with the secret key, since users can't insert rows or read each other's subscriptions.
// Callers pass only users other than the one who made the change.

/** VAPID keys from the env, or null when push isn't set up (then only the bell gets notifications). */
export function vapidDetails(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { subject, publicKey, privateKey };
}

let warnedNoVapid = false;

// Never throws: a missing table (migrations not run), missing VAPID keys or a failed send must not
// undo the change that triggered the notification.
// `store: false` sends only the push, for events the bell already derives from elsewhere.
export async function notify<K extends NotificationKind>(
  userId: string,
  kind: K,
  data: NotificationData[K],
  options: { store?: boolean } = {},
): Promise<void> {
  try {
    const admin = createAdminClient();
    if (options.store !== false) {
      const { error } = await admin.from("notifications").insert({ user_id: userId, kind, data });
      if (error) console.warn(`notify(${kind}) failed: ${error.message}`);
    }
    await push(admin, userId, kind, data as unknown as Record<string, unknown>);
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

async function push(admin: ReturnType<typeof createAdminClient>, userId: string, kind: string, data: Record<string, unknown>) {
  const vapid = vapidDetails();
  if (!vapid) {
    if (!warnedNoVapid) console.warn("Web Push is off: set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.");
    warnedNoVapid = true;
    return;
  }
  const message = describeNotification(kind, data);
  if (!message) return;

  const { data: subs, error } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (error) {
    console.warn(`Web Push skipped (run migration 010?): ${error.message}`);
    return;
  }
  if (!subs?.length) return;

  const payload = JSON.stringify(message);
  await Promise.all(
    (subs as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
      const subscription: PushSubscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await sendNotification(subscription, payload, { vapidDetails: vapid, TTL: 60 * 60 * 24, timeout: 10_000 });
      } catch (e) {
        const status = (e as Partial<WebPushError>)?.statusCode;
        // 404/410: the browser unsubscribed or the subscription expired, so it will never work again.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          console.warn(`Web Push to ${new URL(s.endpoint).host} failed: ${status ?? ""} ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }),
  );
}
