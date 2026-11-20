"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { DrawRow } from "@/lib/draw/ops";

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

export async function updateService(serviceId: string, changes: { name?: string; enabled?: boolean; pollSeconds?: number }): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name) throw new Error("Name is required.");
    fields.name = name;
  }
  if (changes.enabled !== undefined) fields.enabled = !!changes.enabled;
  if (changes.pollSeconds !== undefined) {
    const s = Math.round(changes.pollSeconds);
    if (!(s >= 15 && s <= 3600)) throw new Error("Poll frequency must be between 15 seconds and 1 hour.");
    fields.poll_seconds = s;
  }
  if (!Object.keys(fields).length) return;
  await update(serviceId, fields);
}

export async function deleteService(serviceId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}
