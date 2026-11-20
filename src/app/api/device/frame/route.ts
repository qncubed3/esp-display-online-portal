// The ESP32 poll endpoint.
//
//   GET /api/device/frame            Authorization: Bearer esk_...   (or ?key=esk_... for curl)
//   GET /api/device/frame?since=<id> 304 when the frame hasn't changed
//
// Responses: 200 Frame JSON | 304 unchanged | 204 service disabled | 401 bad key.
// Every response that the device should act on carries X-Next-Poll (seconds).
//
// Note: with `cacheComponents` enabled the `dynamic` segment option is not allowed;
// this handler reads the request, so it always runs at request time.

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashKey } from "@/lib/devices/keys";
import { runDataCode } from "@/lib/data/run";
import { toWireOps, type DrawRow, type Frame, type WireOp } from "@/lib/draw/ops";

export const runtime = "nodejs";

const NEXT_POLL_S = 30;
const DISABLED_POLL_S = 300;

const noStore = { "Cache-Control": "no-store" };

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401, headers: noStore });
}

function errorFrameOps(message: string): WireOp[] {
  const msg = message.replace(/\s+/g, " ").trim();
  const short = msg.length > 50 ? msg.slice(0, 49) + "…" : msg;
  return [
    ["fillScreen", "#000000"],
    ["setTextDatum", "TL"],
    ["setTextColor", "#FF0000"],
    ["setTextSize", 2],
    ["drawString", "DATA ERROR", 8, 8, 1],
    ["setTextColor", "#FFFFFF"],
    ["setTextSize", 1],
    ["drawString", short, 8, 36, 1],
  ];
}

interface DeviceWithService {
  id: string;
  service: { id: string; enabled: boolean; data_code: string; draw_ops: DrawRow[] | null } | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  const key = bearer || url.searchParams.get("key")?.trim();
  if (!key) return unauthorized("Missing device key");
  if (!key.startsWith("esk_")) return unauthorized("Unknown device key");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("devices")
    .select("id, service:services!inner(id, enabled, data_code, draw_ops)")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (error) {
    console.error("[device/frame] lookup failed", error.message);
    return Response.json({ error: "Lookup failed" }, { status: 500, headers: noStore });
  }
  const device = data as unknown as DeviceWithService | null;
  if (!device || !device.service) return unauthorized("Unknown device key");

  // Awaited so it completes before the serverless function is frozen.
  const { error: seenError } = await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);
  if (seenError) console.error("[device/frame] last_seen_at update failed", seenError.message);

  const service = device.service;
  if (!service.enabled) {
    return new Response(null, { status: 204, headers: { ...noStore, "X-Next-Poll": String(DISABLED_POLL_S) } });
  }

  const { vars, error: dataError } = await runDataCode(service.data_code ?? "");
  const ops = dataError
    ? errorFrameOps(dataError)
    : toWireOps(Array.isArray(service.draw_ops) ? service.draw_ops : [], vars);

  const id = createHash("sha256").update(JSON.stringify(ops)).digest("hex").slice(0, 12);
  const headers = { ...noStore, "X-Next-Poll": String(NEXT_POLL_S), ETag: `"${id}"` };

  if (url.searchParams.get("since") === id) {
    return new Response(null, { status: 304, headers });
  }

  const frame: Frame = { v: 1, id, next: NEXT_POLL_S, ops };
  return Response.json(frame, { headers });
}
