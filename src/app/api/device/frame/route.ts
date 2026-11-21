// The ESP32 poll endpoint.
//
//   GET /api/device/frame            Authorization: Bearer esk_...   (or ?key=esk_... for curl)
//   GET /api/device/frame?since=<id> 304 when the frame hasn't changed
//
// Responses: 200 Frame JSON | 304 unchanged | 204 service disabled | 401 bad key.
// Frame schema: v2 when the device sends X-Frame-Version: 2 (firmware v2+), otherwise v1, with
// anything v1 can't draw degraded (see src/lib/draw/frame.ts). A 200 says what was degraded, if
// anything, in X-Frame-Degraded (feature names from src/lib/draw/capabilities.ts).
// A device with no Service (or one its owner can no longer access) gets a 200 "No service assigned"
// frame, so it can be subscribed to a Service from the portal later without reflashing.
// Every response that the device should act on carries X-Next-Poll (seconds), and every reply
// carries X-Poll-Interval: the device's configured interval, which the firmware stores.
//
// Every request with a valid key is logged to device_polls (see src/lib/polls/log.ts).
// Optional device headers recorded with it: X-RSSI, X-Heap, X-Uptime, X-FW.
//
// Note: with `cacheComponents` enabled the `dynamic` segment option is not allowed;
// this handler reads the request, so it always runs at request time.

import { createAdminClient } from "@/lib/supabase/admin";
import { hashKey } from "@/lib/devices/keys";
import { runDataCode } from "@/lib/data/run";
import { loadOwnerRunOptions } from "@/lib/secrets/load";
import { toWireOps, type DrawRow, type WireOp } from "@/lib/draw/ops";
import { featuresNeeded, missingFeatures } from "@/lib/draw/capabilities";
import { buildFrame, requestedFrameVersion } from "@/lib/draw/frame";
import { errorFrameOps, noServiceOps } from "@/lib/draw/screens";
import { readDeviceInfo, recordPoll } from "@/lib/polls/log";

export const runtime = "nodejs";

const NEXT_POLL_S = 30;
const DISABLED_POLL_S = 300;

const noStore = { "Cache-Control": "no-store" };

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401, headers: noStore });
}

interface DeviceWithService {
  id: string;
  name: string;
  owner_id?: string; // added by migration 007
  poll_seconds?: number | null;
  rotation?: number | null; // added by migration 011
  service: {
    id: string;
    owner_id: string;
    enabled: boolean;
    data_code: string;
    draw_ops: DrawRow[] | null;
  } | null;
}

type Service = NonNullable<DeviceWithService["service"]>;

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
    // Left join: a device with no Service is still a valid device.
    .select("*, service:services(id, owner_id, enabled, data_code, draw_ops)")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (error) {
    console.error("[device/frame] lookup failed", error.message);
    return Response.json({ error: "Lookup failed" }, { status: 500, headers: noStore });
  }
  const device = data as unknown as DeviceWithService | null;
  if (!device) return unauthorized("Unknown device key");

  let served: Served;
  let service: Service | null = null;
  try {
    service = await accessibleService(supabase, device);
    served = await serve(supabase, device, service, url, requestedFrameVersion(request.headers.get("x-frame-version")));
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
    service_id: service?.id ?? null,
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

// The device's Service, or null when it has none. Also null when the Service is someone else's and
// the device's owner is no longer a member (e.g. removed after subscribing): RLS only checks access
// when the subscription is written, and this endpoint uses the secret-key client.
async function accessibleService(
  supabase: ReturnType<typeof createAdminClient>,
  device: DeviceWithService,
): Promise<Service | null> {
  const service = device.service;
  if (!service || !device.owner_id || service.owner_id === device.owner_id) return service;
  const { data, error } = await supabase
    .from("service_members")
    .select("service_id")
    .eq("service_id", service.id)
    .eq("user_id", device.owner_id)
    .maybeSingle();
  if (error) throw new Error(`membership check failed: ${error.message}`);
  return data ? service : null;
}

async function serve(
  supabase: ReturnType<typeof createAdminClient>,
  device: DeviceWithService,
  service: Service | null,
  url: URL,
  version: 1 | 2,
): Promise<Served> {
  // Awaited so it completes before the serverless function is frozen.
  const { error: seenError } = await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);
  if (seenError) console.error("[device/frame] last_seen_at update failed", seenError.message);

  const pollInterval = device.poll_seconds ?? NEXT_POLL_S;

  if (service && !service.enabled) {
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

  let ops: WireOp[];
  let dataMs: number | null = null;
  let dataError: string | undefined;
  if (!service) {
    ops = noServiceOps(device.name);
  } else {
    // The Service owner's secrets and timezone, whoever's device this is (they never leave the server).
    const runOptions = await loadOwnerRunOptions(service.owner_id, supabase);
    const dataStarted = performance.now();
    const result = await runDataCode(service.data_code ?? "", runOptions);
    dataMs = performance.now() - dataStarted;
    dataError = result.error ?? undefined;
    ops = dataError
      ? errorFrameOps(dataError)
      : toWireOps(Array.isArray(service.draw_ops) ? service.draw_ops : [], result.vars);
  }

  const frame = buildFrame(ops, { version, rotation: device.rotation, poll: pollInterval });
  const headers = {
    ...noStore,
    "X-Next-Poll": String(pollInterval),
    "X-Poll-Interval": String(pollInterval),
    ETag: `"${frame.id}"`,
  };
  const base = { ops: frame.ops.length, dataMs, error: dataError ?? null };

  if (url.searchParams.get("since") === frame.id) {
    return { response: new Response(null, { status: 304, headers }), status: 304, bytes: 0, ...base };
  }

  const degraded = missingFeatures(featuresNeeded({ rotation: device.rotation, ops }), version);
  const body = JSON.stringify(frame);
  return {
    response: new Response(body, {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json", ...(degraded.length ? { "X-Frame-Degraded": degraded.join(",") } : {}) },
    }),
    status: 200,
    bytes: Buffer.byteLength(body),
    ...base,
  };
}
