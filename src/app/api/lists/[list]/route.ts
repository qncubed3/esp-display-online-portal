// The lists the client cache keeps (src/lib/store/cache.ts).
//   GET /api/lists/services|shared|devices|subscribable  -> Lists[name] (src/lib/lists/types.ts)
// A route handler rather than a Server Action: the client dispatches Server Actions one at a time,
// so background loads would queue up behind each other and in front of the user's own saves.
// Signed-in users only: reads use the user's client, so RLS applies.

import { createClient } from "@/lib/supabase/server";
import { loadList } from "@/lib/lists/load";
import { isListName } from "@/lib/lists/types";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, ctx: { params: Promise<{ list: string }> }) {
  const { list } = await ctx.params;
  if (!isListName(list)) return Response.json({ error: "Unknown list" }, { status: 404, headers: noStore });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401, headers: noStore });

  try {
    return Response.json(await loadList(supabase, user.id, list), { headers: noStore });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[lists/${list}] failed`, message);
    return Response.json({ error: message }, { status: 500, headers: noStore });
  }
}
