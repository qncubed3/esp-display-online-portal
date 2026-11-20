"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Sharing a Service with other users. Everything runs as the signed-in user (RLS applies),
// except the email -> user id lookup, which needs the secret key.

export interface MemberRow {
  user_id: string;
  email: string;
  created_at: string;
}

export interface NotificationRow {
  service_id: string;
  service_name: string;
  created_at: string;
  seen_at: string | null;
}

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
    .select("id")
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

// Owner removes a member.
export async function removeMember(serviceId: string, userId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("service_members")
    .delete()
    .eq("service_id", serviceId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Member not found.");
  revalidateService(serviceId);
}

// A member leaves a Service shared with them.
export async function leaveService(serviceId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("service_members")
    .delete()
    .eq("service_id", serviceId)
    .eq("user_id", user.id)
    .select("service_id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("You are not a member of this service.");
  revalidatePath("/");
  revalidatePath("/shared");
  redirect("/shared");
}

// Services the caller has been added to, newest first.
export async function listNotifications(): Promise<NotificationRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("service_members")
    .select("service_id, created_at, seen_at, services(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  type Row = {
    service_id: string;
    created_at: string;
    seen_at: string | null;
    services: { name: string } | { name: string }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const svc = Array.isArray(r.services) ? r.services[0] : r.services;
    return {
      service_id: r.service_id,
      service_name: svc?.name ?? "a service",
      created_at: r.created_at,
      seen_at: r.seen_at,
    };
  });
}

export async function markNotificationsSeen(): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("service_members")
    .update({ seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("seen_at", null);
  if (error) throw new Error(error.message);
}
