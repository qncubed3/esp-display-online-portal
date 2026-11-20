"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { DrawRow } from "@/lib/draw/ops";
import { notifyMany } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";

// All actions run as the signed-in user, so RLS limits them to the user's own services.
// They throw on failure; callers show the error.

async function update(serviceId: string, fields: Record<string, unknown>) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("services")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", serviceId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Service not found.");
  revalidatePath("/");
  revalidatePath(`/services/${serviceId}`);
}

export async function saveService(serviceId: string, changes: { data_code: string; draw_ops: DrawRow[] }): Promise<void> {
  if (typeof changes?.data_code !== "string") throw new Error("Invalid code.");
  if (!Array.isArray(changes.draw_ops)) throw new Error("Invalid draw rows.");
  await update(serviceId, { data_code: changes.data_code, draw_ops: changes.draw_ops });
}

// Everyone a change to a Service affects: its owner, its members, and the owners of devices on it,
// with how many of each user's devices are on it. Read with the secret key (members can't see
// each other). Empty on failure: notifications are best effort.
async function serviceAudience(serviceId: string): Promise<Map<string, number>> {
  const admin = createAdminClient();
  const [svc, members, devices] = await Promise.all([
    admin.from("services").select("owner_id").eq("id", serviceId).maybeSingle(),
    admin.from("service_members").select("user_id").eq("service_id", serviceId),
    admin.from("devices").select("owner_id").eq("service_id", serviceId),
  ]);
  const audience = new Map<string, number>();
  const owner = (svc.data as { owner_id: string } | null)?.owner_id;
  if (owner) audience.set(owner, 0);
  for (const m of (members.data ?? []) as { user_id: string }[]) audience.set(m.user_id, audience.get(m.user_id) ?? 0);
  for (const d of (devices.data ?? []) as { owner_id: string }[]) audience.set(d.owner_id, (audience.get(d.owner_id) ?? 0) + 1);
  return audience;
}

export async function updateService(serviceId: string, changes: { name?: string; enabled?: boolean }): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new Error("Name is required.");
    fields.name = name;
  }
  if (changes.enabled !== undefined) fields.enabled = !!changes.enabled;
  if (!Object.keys(fields).length) return;

  const { supabase, user } = await requireUser();
  const { data: before } = await supabase.from("services").select("name, enabled").eq("id", serviceId).maybeSingle();
  await update(serviceId, fields);

  // Tell everyone else on the Service about renames and on/off switches (not code edits).
  const prev = before as { name: string; enabled: boolean } | null;
  if (!prev) return;
  const renamed = fields.name !== undefined && fields.name !== prev.name;
  const toggled = fields.enabled !== undefined && fields.enabled !== prev.enabled;
  if (!renamed && !toggled) return;
  const audience = [...(await serviceAudience(serviceId)).keys()];
  const name = (fields.name as string | undefined) ?? prev.name;
  const by_email = user.email ?? "Someone";
  await Promise.all([
    renamed &&
      notifyMany(audience, user.id, "service_updated", { service_id: serviceId, service_name: name, by_email, change: "renamed", old_name: prev.name }),
    toggled &&
      notifyMany(audience, user.id, "service_updated", {
        service_id: serviceId,
        service_name: name,
        by_email,
        change: fields.enabled ? "enabled" : "disabled",
      }),
  ]);
}

// Members and the owners of devices on it get a notification (their devices become unsubscribed).
export async function deleteService(serviceId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const [{ data: svc }, audience] = await Promise.all([
    supabase.from("services").select("name").eq("id", serviceId).maybeSingle(),
    serviceAudience(serviceId),
  ]);
  const { data, error } = await supabase.from("services").delete().eq("id", serviceId).select("id");
  if (error) throw new Error(error.message);
  if (data?.length) {
    const service_name = (svc as { name: string } | null)?.name ?? "a service";
    await notifyMany(audience.keys(), user.id, "service_deleted", (id) => ({
      service_name,
      by_email: user.email ?? "The owner",
      devices: audience.get(id) ?? 0,
    }));
  }
  revalidatePath("/");
  redirect("/");
}
