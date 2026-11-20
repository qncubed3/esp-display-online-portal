// Writes one device_polls row per device request to /api/device/frame.
// Uses the secret-key client (the table has no insert policy). Never throws.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 7;
const PRUNE_CHANCE = 0.01; // ~1% of polls also delete old rows for their Service

export interface PollRecord {
  device_id: string;
  service_id: string;
  status: number;
  duration_ms: number;
  data_ms?: number | null;
  bytes?: number | null;
  ops?: number | null;
  error?: string | null;
  ip?: string | null;
  rssi?: number | null;
  heap?: number | null;
  uptime_s?: number | null;
  fw?: string | null;
}

export type PollDeviceInfo = Pick<PollRecord, "ip" | "rssi" | "heap" | "uptime_s" | "fw">;

// Strict integer parse: "-67" ok, "-67dBm" / "1e3" / "" rejected; out of range -> null.
function intHeader(value: string | null, min: number, max: number): number | null {
  if (value == null) return null;
  const s = value.trim();
  if (!/^-?\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

function textHeader(value: string | null, maxLen: number): string | null {
  if (value == null) return null;
  // Printable ASCII only; collapse anything else.
  const s = value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, maxLen);
  return s || null;
}

function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return textHeader(forwarded || headers.get("x-real-ip"), 64);
}

const INT32_MAX = 2147483647;

// Optional diagnostics the firmware can send: X-RSSI (dBm), X-Heap (free bytes), X-Uptime (s), X-FW.
export function readDeviceInfo(request: Request): PollDeviceInfo {
  const h = request.headers;
  return {
    ip: clientIp(h),
    rssi: intHeader(h.get("x-rssi"), -128, 0),
    heap: intHeader(h.get("x-heap"), 0, INT32_MAX),
    uptime_s: intHeader(h.get("x-uptime"), 0, INT32_MAX),
    fw: textHeader(h.get("x-fw"), 40),
  };
}

export async function recordPoll(supabase: SupabaseClient, row: PollRecord): Promise<void> {
  try {
    const clean: PollRecord = {
      ...row,
      duration_ms: Math.max(0, Math.round(row.duration_ms)),
      data_ms: row.data_ms == null ? null : Math.max(0, Math.round(row.data_ms)),
      error: row.error ? row.error.slice(0, 500) : null,
    };
    const { error } = await supabase.from("device_polls").insert(clean);
    if (error) console.error("[polls] insert failed", error.message);

    if (Math.random() < PRUNE_CHANCE) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
      const { error: pruneError } = await supabase
        .from("device_polls")
        .delete()
        .eq("service_id", row.service_id)
        .lt("at", cutoff);
      if (pruneError) console.error("[polls] prune failed", pruneError.message);
    }
  } catch (e) {
    console.error("[polls] logging failed", e instanceof Error ? e.message : e);
  }
}
