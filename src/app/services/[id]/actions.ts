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

export async function saveDrawOps(serviceId: string, rows: DrawRow[]): Promise<void> {
  if (!Array.isArray(rows)) throw new Error("Invalid draw rows.");
  await update(serviceId, { draw_ops: rows });
}

export async function saveDataCode(serviceId: string, code: string): Promise<void> {
  if (typeof code !== "string") throw new Error("Invalid code.");
  await update(serviceId, { data_code: code });
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
  await update(serviceId, fields);
}

export async function deleteService(serviceId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}
