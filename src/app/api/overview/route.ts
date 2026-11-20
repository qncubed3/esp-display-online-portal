// Account-wide poll stats for the Overview page.
//   GET /api/overview?range=1h|24h|7d  -> Overview (src/lib/overview/types.ts)
// Signed-in users only: reads use the user's client, so RLS limits it to Services they can access.

import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/overview/stats";
import { isActivityRange } from "@/lib/polls/types";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
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
    return Response.json(await loadOverview(supabase, user.id, rangeParam), { headers: noStore });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[overview] failed", message);
    return Response.json({ error: message }, { status: 500, headers: noStore });
  }
}
