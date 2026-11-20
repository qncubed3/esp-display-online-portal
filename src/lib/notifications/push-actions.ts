"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { vapidDetails } from "./notify";

// Saving and removing this browser's Web Push subscription (migration 010), for the Settings card.
// Errors come back as values so the message survives production builds.

/** Whether the server can send pushes (VAPID env vars set). */
export async function pushConfigured(): Promise<boolean> {
  await requireUser();
  return vapidDetails() !== null;
}

interface SubscriptionJson {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

// Upserts by endpoint with the secret key: a browser has one endpoint, and if someone else used to
// be signed in here, it now belongs to whoever turned push on last.
export async function savePushSubscription(sub: SubscriptionJson, userAgent?: string): Promise<{ error?: string }> {
  const { user } = await requireUser();
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return { error: "Invalid push subscription." };

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent?.slice(0, 300) ?? null },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.warn(`savePushSubscription failed: ${error.message}`);
    return { error: "Could not save this browser for push notifications. Has migration 010 been run?" };
  }
  return {};
}

export async function removePushSubscription(endpoint: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.warn(`removePushSubscription failed: ${error.message}`);
    return { error: error.message };
  }
  return {};
}
