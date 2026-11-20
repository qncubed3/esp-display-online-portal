"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { secretNameError, secretValueError } from "@/lib/secrets/name";

// The signed-in user's secrets. Everything runs with the user's client, so RLS limits it to
// their own rows. Values are only sent to the browser on an explicit reveal/copy.

export interface SecretRow {
  name: string;
  created_at: string;
  updated_at: string;
}

type Result<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T);

export async function createSecret(name: string, value: string): Promise<Result<{ secret: SecretRow }>> {
  const n = String(name ?? "").trim();
  const v = String(value ?? "").trim();
  const problem = secretNameError(n) ?? secretValueError(v);
  if (problem) return { error: problem };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_secrets")
    .insert({ owner_id: user.id, name: n, value: v })
    .select("name, created_at, updated_at")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `${n} already exists. Edit it instead.` };
    return { error: error.message };
  }
  revalidatePath("/secrets");
  return { secret: data as SecretRow };
}

export async function updateSecret(name: string, value: string): Promise<Result<{ secret: SecretRow }>> {
  const n = String(name ?? "").trim();
  const v = String(value ?? "").trim();
  const problem = secretNameError(n) ?? secretValueError(v);
  if (problem) return { error: problem };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_secrets")
    .update({ value: v, updated_at: new Date().toISOString() })
    .eq("owner_id", user.id)
    .eq("name", n)
    .select("name, created_at, updated_at")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: `${n} no longer exists.` };
  revalidatePath("/secrets");
  return { secret: data as SecretRow };
}

export async function deleteSecret(name: string): Promise<Result> {
  const n = String(name ?? "").trim();
  if (secretNameError(n)) return { error: "Unknown secret." };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("user_secrets").delete().eq("owner_id", user.id).eq("name", n);
  if (error) return { error: error.message };
  revalidatePath("/secrets");
  return {};
}

// The value of one of the user's own secrets, for the reveal toggle and copy button.
export async function revealSecret(name: string): Promise<Result<{ value: string }>> {
  const n = String(name ?? "").trim();
  if (secretNameError(n)) return { error: "Unknown secret." };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("user_secrets")
    .select("value")
    .eq("owner_id", user.id)
    .eq("name", n)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: `${n} no longer exists.` };
  return { value: (data as { value: string }).value };
}
