import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIME_ZONE, type RunOptions } from "@/lib/data/run";

// Loads what a Service owner's Data code runs with: their secrets (secrets.NAME) and their
// timezone (now()). Uses the admin client (bypasses RLS) because the caller may be a device
// or a member of a shared Service. The values never leave the server.
// A failed lookup is logged and degrades to no secrets / the default timezone, so the Data
// code still runs (and fails visibly if it needed a secret).
export async function loadOwnerRunOptions(
  ownerId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<Required<RunOptions>> {
  const [secretsRes, settingsRes] = await Promise.all([
    admin.from("user_secrets").select("name, value").eq("owner_id", ownerId),
    admin.from("user_settings").select("timezone").eq("user_id", ownerId).maybeSingle(),
  ]);

  const secrets: Record<string, string> = {};
  if (secretsRes.error) console.error("[secrets] load failed", secretsRes.error.message);
  for (const row of (secretsRes.data ?? []) as { name: string; value: string }[]) secrets[row.name] = row.value;

  if (settingsRes.error) console.error("[secrets] settings load failed", settingsRes.error.message);
  const timeZone = (settingsRes.data as { timezone: string | null } | null)?.timezone || DEFAULT_TIME_ZONE;

  return { secrets, timeZone };
}
