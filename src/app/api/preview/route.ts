// Runs a Service's saved Data section for the Draw editor's preview.
//   POST { serviceId } -> { vars, error? }
// Signed-in owners only: the service is read with the user's client, so RLS applies.

import { createClient } from "@/lib/supabase/server";
import { runDataCode } from "@/lib/data/run";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let serviceId: unknown;
  try {
    ({ serviceId } = await request.json());
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
    .select("data_code")
    .eq("id", serviceId)
    .maybeSingle();
  if (error && error.code !== "22P02") return Response.json({ error: error.message }, { status: 500 });
  if (!service) return Response.json({ error: "Service not found" }, { status: 404 });

  const result = await runDataCode((service as { data_code: string | null }).data_code ?? "");
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
