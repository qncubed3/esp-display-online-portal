// Runs a Service's Data section for the Draw editor's preview.
//   POST { serviceId, code? } -> { vars, error? }
// When `code` is a string (the editor's unsaved code) it runs instead of the saved data_code.
// Signed-in owners and members: the service is read with the user's client, so RLS applies.
// The code runs with the Service OWNER's secrets and timezone (loaded with the admin client),
// even when the caller is a member; secret values are redacted from the response.

import { createClient } from "@/lib/supabase/server";
import { runDataCode } from "@/lib/data/run";
import { loadOwnerRunOptions } from "@/lib/secrets/load";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let serviceId: unknown;
  let code: unknown;
  try {
    ({ serviceId, code } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof serviceId !== "string" || !serviceId) {
    return Response.json({ error: "serviceId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data: service, error } = await supabase
    .from("services")
    .select("data_code, owner_id")
    .eq("id", serviceId)
    .maybeSingle();
  if (error && error.code !== "22P02") return Response.json({ error: error.message }, { status: 500 });
  if (!service) return Response.json({ error: "Service not found" }, { status: 404 });

  const row = service as { data_code: string | null; owner_id: string };
  const source = typeof code === "string" ? code : (row.data_code ?? "");
  const result = await runDataCode(source, await loadOwnerRunOptions(row.owner_id));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
