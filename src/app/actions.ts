"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function createService(name: string): Promise<{ error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("services").insert({ name: trimmed }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Could not create service." };

  redirect(`/services/${data.id}`);
}
