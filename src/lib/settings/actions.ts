"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/settings/timezones";

export type SettingsResult = { error?: string; ok?: boolean };

export async function changePassword(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function saveTimezone(timezone: string): Promise<SettingsResult> {
  if (!timezone || !isValidTimeZone(timezone)) return { error: "Unknown time zone." };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, timezone, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function signOutEverywhere(): Promise<SettingsResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { error: error.message };
  redirect("/login");
}
