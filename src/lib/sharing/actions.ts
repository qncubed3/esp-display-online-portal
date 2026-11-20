"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeNotification, type NotificationKind } from "@/lib/notifications/messages";
import { notify } from "@/lib/notifications/notify";

// Sharing a Service with other users. Everything runs as the signed-in user (RLS applies),
// except the email -> user id lookup, which needs the secret key.

export interface MemberRow {
  user_id: string;
  email: string;
  created_at: string;
}

// The bell's items: Services the user was added to (from service_members) and everything in the
// notifications table (migration 009): devices transferred to them, changes to their Services, etc.
// Table rows are turned into title/body/url by lib/notifications/messages.ts.
export type NotificationRow =
  | { kind: "shared"; id: string; service_id: string; service_name: string; created_at: string; seen_at: string | null }
  | {
      kind: NotificationKind;
      id: string;
      title: string;
      body: string;
      url: string;
      created_at: string;
      seen_at: string | null;
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidateService(serviceId: string) {
  revalidatePath("/");
  revalidatePath(`/services/${serviceId}`);
}

// Members of a Service. Owners see everyone; a member sees only their own row (RLS).
export async function listMembers(serviceId: string): Promise<MemberRow[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("service_members")
    .select("user_id, email, created_at")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}

// Adds an existing user as a member. Returns a friendly error instead of throwing,
// so the message survives production builds.
export async function inviteMember(serviceId: string, email: string): Promise<{ error?: string; member?: MemberRow }> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return { error: "Enter a valid email address." };

  const { supabase, user } = await requireUser();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name")
    .eq("id", serviceId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (serviceError) return { error: serviceError.message };
  if (!service) return { error: "Only the owner can share this service." };

  if (normalized === (user.email ?? "").toLowerCase()) return { error: "That's you." };

  const { data: userId, error: lookupError } = await createAdminClient().rpc("user_id_by_email", {
    p_email: normalized,
  });
  if (lookupError) return { error: "Could not look up that email." };
  if (!userId) return { error: "No user with that email." };
  if (userId === user.id) return { error: "That's you." };

  const { data, error } = await supabase
    .from("service_members")
    .insert({ service_id: serviceId, user_id: userId as string, email: normalized, added_by: user.id })
    .select("user_id, email, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Already a member." };
    return { error: error.message };
  }

  revalidateService(serviceId);
  return { member: data as MemberRow };
}

// Owner removes a member, who gets a notification.
export async function removeMember(serviceId: string, userId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data: service } = await supabase.from("services").select("name").eq("id", serviceId).maybeSingle();
  const { data, error } = await supabase
    .from("service_members")
    .delete()
    .eq("service_id", serviceId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Member not found.");
  if (userId !== user.id) {
    await notify(userId, "member_removed", {
      service_id: serviceId,
      service_name: (service as { name: string } | null)?.name ?? "a service",
      by_email: user.email ?? "The owner",
    });
  }
  revalidateService(serviceId);
}

// A member leaves a Service shared with them; the owner gets a notification.
export async function leaveService(serviceId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data: service } = await supabase.from("services").select("name, owner_id").eq("id", serviceId).maybeSingle();
  const { data, error } = await supabase
    .from("service_members")
    .delete()
    .eq("service_id", serviceId)
    .eq("user_id", user.id)
    .select("service_id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("You are not a member of this service.");
  const svc = service as { name: string; owner_id: string } | null;
  if (svc && svc.owner_id !== user.id) {
    await notify(svc.owner_id, "member_left", {
      service_id: serviceId,
      service_name: svc.name,
      member_email: user.email ?? "A member",
    });
  }
  revalidatePath("/");
  revalidatePath("/shared");
  redirect("/shared");
}

// The caller's notifications, newest first. The notifications table is optional (migration 009):
// if it's missing, only the "added to a Service" items show.
export async function listNotifications(): Promise<NotificationRow[]> {
  const { supabase, user } = await requireUser();
  const [members, other] = await Promise.all([
    supabase
      .from("service_members")
      .select("service_id, created_at, seen_at, services(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("notifications").select("id, kind, data, created_at, seen_at").order("created_at", { ascending: false }).limit(50),
  ]);
  if (members.error) throw new Error(members.error.message);
  type MemberNotice = {
    service_id: string;
    created_at: string;
    seen_at: string | null;
    services: { name: string } | { name: string }[] | null;
  };
  const shared: NotificationRow[] = ((members.data ?? []) as unknown as MemberNotice[]).map((r) => {
    const svc = Array.isArray(r.services) ? r.services[0] : r.services;
    return {
      kind: "shared",
      id: `shared:${r.service_id}`,
      service_id: r.service_id,
      service_name: svc?.name ?? "a service",
      created_at: r.created_at,
      seen_at: r.seen_at,
    };
  });

  type Notice = { id: number; kind: string; data: Record<string, unknown> | null; created_at: string; seen_at: string | null };
  const rest: NotificationRow[] = [];
  for (const n of (other.error ? [] : (other.data ?? [])) as Notice[]) {
    const message = describeNotification(n.kind, n.data);
    if (!message) continue;
    rest.push({
      kind: n.kind as NotificationKind,
      id: `n:${n.id}`,
      ...message,
      created_at: n.created_at,
      seen_at: n.seen_at,
    });
  }

  return [...shared, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

export async function markNotificationsSeen(): Promise<void> {
  const { supabase, user } = await requireUser();
  const seenAt = new Date().toISOString();
  const [members] = await Promise.all([
    supabase.from("service_members").update({ seen_at: seenAt }).eq("user_id", user.id).is("seen_at", null),
    // Ignored if migration 009 hasn't run.
    supabase.from("notifications").update({ seen_at: seenAt }).eq("user_id", user.id).is("seen_at", null),
  ]);
  if (members.error) throw new Error(members.error.message);
}
