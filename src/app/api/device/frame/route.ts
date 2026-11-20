// The ESP32 poll endpoint.
//
//   GET /api/device/frame            Authorization: Bearer esk_...   (or ?key=esk_... for curl)
//   GET /api/device/frame?since=<id> 304 when the frame hasn't changed
//
// Responses: 200 Frame JSON | 304 unchanged | 204 service disabled | 401 bad key.
// Every response that the device should act on carries X-Next-Poll (seconds), and every reply
// carries X-Poll-Interval: the device's configured interval, which the firmware stores.
//
// Every request with a valid key is logged to device_polls (see src/lib/polls/log.ts).
// Optional device headers recorded with it: X-RSSI, X-Heap, X-Uptime, X-FW.
//
// Note: with `cacheComponents` enabled the `dynamic` segment option is not allowed;
// this handler reads the request, so it always runs at request time.

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashKey } from "@/lib/devices/keys";
import { runDataCode } from "@/lib/data/run";
import { loadOwnerRunOptions } from "@/lib/secrets/load";
import { toWireOps, type DrawRow, type Frame, type WireOp } from "@/lib/draw/ops";
import { readDeviceInfo, recordPoll } from "@/lib/polls/log";

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
  poll_seconds?: number | null;
  service: {
    id: string;
    owner_id: string;
    enabled: boolean;
    data_code: string;
    draw_ops: DrawRow[] | null;
  } | null;
}

interface Served {
  response: Response;
  status: number;
  bytes: number | null;
  ops: number | null;
  dataMs: number | null;
  error: string | null;
}

export async function GET(request: Request) {
  const started = performance.now();
  const url = new URL(request.url);
  const auth = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  const key = bearer || url.searchParams.get("key")?.trim();
  if (!key) return unauthorized("Missing device key");
  if (!key.startsWith("esk_")) return unauthorized("Unknown device key");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("devices")
    .select("*, service:services!inner(id, owner_id, enabled, data_code, draw_ops)")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (error) {
    console.error("[device/frame] lookup failed", error.message);
    return Response.json({ error: "Lookup failed" }, { status: 500, headers: noStore });
  }
  const device = data as unknown as DeviceWithService | null;
  if (!device || !device.service) return unauthorized("Unknown device key");

  let served: Served;
  try {
    served = await serve(supabase, device, device.service, url);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[device/frame] failed", message);
    const body = JSON.stringify({ error: "Internal error" });
    served = {
      response: new Response(body, {
        status: 500,
        headers: { ...noStore, "Content-Type": "application/json", "X-Next-Poll": String(NEXT_POLL_S) },
      }),
      status: 500,
      bytes: Buffer.byteLength(body),
      ops: null,
      dataMs: null,
      error: message,
    };
  }

  // Awaited so it completes before the serverless function is frozen. Never throws.
  await recordPoll(supabase, {
    device_id: device.id,
    service_id: device.service.id,
    status: served.status,
    duration_ms: performance.now() - started,
    data_ms: served.dataMs,
    bytes: served.bytes,
    ops: served.ops,
    error: served.error,
    ...readDeviceInfo(request),
  });

  return served.response;
}

async function serve(
  supabase: ReturnType<typeof createAdminClient>,
  device: DeviceWithService,
  service: NonNullable<DeviceWithService["service"]>,
  url: URL,
): Promise<Served> {
  // Awaited so it completes before the serverless function is frozen.
  const { error: seenError } = await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);
  if (seenError) console.error("[device/frame] last_seen_at update failed", seenError.message);

  const pollInterval = device.poll_seconds ?? NEXT_POLL_S;

  if (!service.enabled) {
    return {
      response: new Response(null, {
        status: 204,
        headers: { ...noStore, "X-Next-Poll": String(DISABLED_POLL_S), "X-Poll-Interval": String(pollInterval) },
      }),
      status: 204,
      bytes: 0,
      ops: null,
      dataMs: null,
      error: null,
    };
  }

  // The owner's secrets and timezone, whoever's device this is (they never leave the server).
  const runOptions = await loadOwnerRunOptions(service.owner_id, supabase);
  const dataStarted = performance.now();
  const { vars, error: dataError } = await runDataCode(service.data_code ?? "", runOptions);
  const dataMs = performance.now() - dataStarted;
  const ops = dataError
    ? errorFrameOps(dataError)
    : toWireOps(Array.isArray(service.draw_ops) ? service.draw_ops : [], vars);

  const id = createHash("sha256").update(JSON.stringify(ops)).digest("hex").slice(0, 12);
  const headers = {
    ...noStore,
    "X-Next-Poll": String(pollInterval),
    "X-Poll-Interval": String(pollInterval),
    ETag: `"${id}"`,
  };
  const base = { ops: ops.length, dataMs, error: dataError ?? null };

  if (url.searchParams.get("since") === id) {
    return { response: new Response(null, { status: 304, headers }), status: 304, bytes: 0, ...base };
  }

  const frame: Frame = { v: 1, id, next: pollInterval, poll: pollInterval, ops };
  const body = JSON.stringify(frame);
  return {
    response: new Response(body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } }),
    status: 200,
    bytes: Buffer.byteLength(body),
    ...base,
  };
}
