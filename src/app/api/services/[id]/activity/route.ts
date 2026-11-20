// Poll log stats for a Service's Activity section.
//   GET /api/services/<id>/activity?range=1h|24h|7d  -> ServiceActivity (src/lib/polls/types.ts)
// Signed-in users with access to the Service only: reads use the user's client, so RLS applies.

import { createClient } from "@/lib/supabase/server";
import { loadServiceActivity } from "@/lib/polls/stats";
import { isActivityRange } from "@/lib/polls/types";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rangeParam = new URL(request.url).searchParams.get("range") ?? "24h";
  if (!isActivityRange(rangeParam)) {
    return Response.json({ error: "range must be 1h, 24h or 7d" }, { status: 400, headers: noStore });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401, headers: noStore });

  try {
    const activity = await loadServiceActivity(supabase, id, rangeParam);
    if (!activity) return Response.json({ error: "Service not found" }, { status: 404, headers: noStore });
    return Response.json(activity, { headers: noStore });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[services/activity] failed", message);
    return Response.json({ error: message }, { status: 500, headers: noStore });
  }
}
