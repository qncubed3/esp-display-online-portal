// Poll log stats for the service page's Activity section.
// Reads with the signed-in user's client, so RLS (can_access_service) applies.
// Bucketing is done here in TypeScript; rows are fetched in pages (PostgREST caps a
// response at 1000 rows) up to MAX_ROWS, newest first.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import type {
  ActivityBucket,
  ActivityRange,
  DeviceActivity,
  RecentPoll,
  ServiceActivity,
} from "./types";

const RANGE_MS: Record<ActivityRange, number> = {
  "1h": 3600_000,
  "24h": 86400_000,
  "7d": 7 * 86400_000,
};
const BUCKET_MS: Record<ActivityRange, number> = {
  "1h": 60_000, // 60 buckets
  "24h": 15 * 60_000, // 96 buckets
  "7d": 2 * 3600_000, // 84 buckets
};
const PAGE = 1000;
const MAX_ROWS = 20_000; // ~one device polling every 30s for 7 days
const RECENT = 50;
const ONLINE_MS = 2 * 60_000;

interface RangeRow {
  id: number;
  device_id: string;
  at: string;
  status: number;
  duration_ms: number;
  data_ms: number | null;
  error: string | null;
  rssi: number | null;
}

interface FullRow extends RangeRow {
  bytes: number | null;
  ops: number | null;
  heap: number | null;
  uptime_s: number | null;
  fw: string | null;
  ip: string | null;
}

const RANGE_COLS = "id, device_id, at, status, duration_ms, data_ms, error, rssi";
const FULL_COLS = `${RANGE_COLS}, bytes, ops, heap, uptime_s, fw, ip`;

const isSuccess = (r: { status: number; error: string | null }) =>
  (r.status === 200 || r.status === 204 || r.status === 304) && !r.error;

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// Nearest-rank percentile.
function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

async function fetchRange(
  supabase: SupabaseClient,
  serviceId: string,
  fromIso: string,
): Promise<{ rows: RangeRow[]; truncated: boolean; total: number }> {
  const query = () =>
    supabase
      .from("device_polls")
      .select(RANGE_COLS, { count: "exact" })
      .eq("service_id", serviceId)
      .gte("at", fromIso)
      .order("at", { ascending: false })
      .order("id", { ascending: false });

  const first = await query().range(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = (first.data ?? []) as RangeRow[];
  const total = first.count ?? rows.length;
  const want = Math.min(total, MAX_ROWS);

  if (want > rows.length) {
    const pages: Promise<RangeRow[]>[] = [];
    for (let offset = PAGE; offset < want; offset += PAGE) {
      pages.push(
        (async () => {
          const res = await query().range(offset, Math.min(offset + PAGE, want) - 1);
          if (res.error) throw new Error(res.error.message);
          return (res.data ?? []) as RangeRow[];
        })(),
      );
    }
    for (const page of await Promise.all(pages)) rows.push(...page);
  }

  // Offsets can shift if polls arrive between pages; drop duplicates.
  const seen = new Set<number>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return { rows: unique, truncated: total > MAX_ROWS, total: Math.max(total, unique.length) };
}

// Same as getServiceActivity, with a client the caller already authenticated.
// Returns null when the Service doesn't exist or the user can't access it.
export async function loadServiceActivity(
  supabase: SupabaseClient,
  serviceId: string,
  range: ActivityRange,
): Promise<ServiceActivity | null> {
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("id", serviceId)
    .maybeSingle();
  if (serviceError && serviceError.code !== "22P02") throw new Error(serviceError.message);
  if (!service) return null;

  const now = Date.now();
  const bucketMs = BUCKET_MS[range];
  // Align buckets to bucket boundaries; the first bucket may start slightly before the range.
  const lastStart = Math.floor(now / bucketMs) * bucketMs;
  const bucketCount = Math.round(RANGE_MS[range] / bucketMs);
  const firstStart = lastStart - (bucketCount - 1) * bucketMs;
  const from = firstStart;

  const [devicesRes, rangeRes, recentRes] = await Promise.all([
    supabase.from("devices").select("id, name, last_seen_at").eq("service_id", serviceId).order("created_at"),
    fetchRange(supabase, serviceId, new Date(from).toISOString()),
    supabase
      .from("device_polls")
      .select(FULL_COLS)
      .eq("service_id", serviceId)
      .order("at", { ascending: false })
      .order("id", { ascending: false })
      .limit(RECENT),
  ]);
  if (devicesRes.error) throw new Error(devicesRes.error.message);
  if (recentRes.error) throw new Error(recentRes.error.message);

  const deviceRows = (devicesRes.data ?? []) as { id: string; name: string; last_seen_at: string | null }[];
  const names = new Map(deviceRows.map((d) => [d.id, d.name]));
  const recentRows = (recentRes.data ?? []) as FullRow[];
  const { rows, truncated, total } = rangeRes;

  // Polls from devices that have since moved to another Service (or none): look their names up.
  // RLS hides devices the user can't see any more; those show as "Other device".
  const unnamed = [...new Set(recentRows.map((r) => r.device_id))].filter((id) => !names.has(id));
  if (unnamed.length) {
    const { data: moved } = await supabase.from("devices").select("id, name").in("id", unnamed);
    for (const d of (moved ?? []) as { id: string; name: string }[]) names.set(d.id, d.name);
  }

  // Latest logged poll per device, for RSSI / heap / fw / uptime. Most come from `recent`;
  // devices that haven't polled lately get one small query each.
  const latest = new Map<string, FullRow>();
  for (const r of recentRows) if (!latest.has(r.device_id)) latest.set(r.device_id, r);
  const missing = deviceRows.filter((d) => !latest.has(d.id) && d.last_seen_at);
  if (missing.length) {
    const results = await Promise.all(
      missing.map((d) =>
        supabase
          .from("device_polls")
          .select(FULL_COLS)
          .eq("device_id", d.id)
          .order("at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    );
    for (const res of results) {
      const r = res.data as FullRow | null;
      if (r) latest.set(r.device_id, r);
    }
  }

  // Per-device stats over the range.
  const byDevice = new Map<string, RangeRow[]>();
  for (const r of rows) {
    const list = byDevice.get(r.device_id);
    if (list) list.push(r);
    else byDevice.set(r.device_id, [r]);
  }

  // Header fields: a device that stops sending a header keeps its last known value.
  const lastKnown = (deviceId: string, pick: (r: FullRow) => number | string | null) => {
    const l = latest.get(deviceId);
    return l ? pick(l) : null;
  };

  const devices: DeviceActivity[] = deviceRows.map((d) => {
    const polls = byDevice.get(d.id) ?? [];
    const durations = polls.map((p) => p.duration_ms);
    return {
      id: d.id,
      name: d.name,
      lastSeenAt: d.last_seen_at,
      online: !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_MS,
      polls: polls.length,
      successRate: polls.length ? polls.filter(isSuccess).length / polls.length : null,
      avgMs: avg(durations),
      p95Ms: percentile(durations, 95),
      rssi: lastKnown(d.id, (r) => r.rssi) as number | null,
      heap: lastKnown(d.id, (r) => r.heap) as number | null,
      fw: lastKnown(d.id, (r) => r.fw) as string | null,
      uptimeS: lastKnown(d.id, (r) => r.uptime_s) as number | null,
      ip: lastKnown(d.id, (r) => r.ip) as string | null,
    };
  });

  // Time buckets.
  const groups: RangeRow[][] = Array.from({ length: bucketCount }, () => []);
  for (const r of rows) {
    const i = Math.floor((new Date(r.at).getTime() - firstStart) / bucketMs);
    if (i >= 0 && i < bucketCount) groups[i].push(r);
  }
  const buckets: ActivityBucket[] = groups.map((g, i) => {
    const durations = g.map((r) => r.duration_ms);
    const dataMs = g.map((r) => r.data_ms).filter((x): x is number => x != null);
    const rssi = g.map((r) => r.rssi).filter((x): x is number => x != null);
    let ok = 0, notModified = 0, disabled = 0, error = 0;
    for (const r of g) {
      if (r.status >= 500 || r.error) error++;
      else if (r.status === 304) notModified++;
      else if (r.status === 204) disabled++;
      else if (r.status === 200) ok++;
      else error++;
    }
    return {
      t: firstStart + i * bucketMs,
      count: g.length,
      ok,
      notModified,
      disabled,
      error,
      avgMs: avg(durations),
      p95Ms: percentile(durations, 95),
      avgDataMs: avg(dataMs),
      avgRssi: avg(rssi),
    };
  });

  const recent: RecentPoll[] = recentRows.map((r) => ({
    id: r.id,
    at: r.at,
    deviceId: r.device_id,
    deviceName: names.get(r.device_id) ?? "Other or deleted device",
    status: r.status,
    durationMs: r.duration_ms,
    dataMs: r.data_ms,
    bytes: r.bytes,
    ops: r.ops,
    error: r.error,
    rssi: r.rssi,
  }));

  const allDurations = rows.map((r) => r.duration_ms);
  return {
    range,
    from,
    to: now,
    bucketMs,
    generatedAt: new Date(now).toISOString(),
    truncated,
    summary: {
      polls: total, // stats below use the fetched (newest MAX_ROWS) polls
      successRate: rows.length ? rows.filter(isSuccess).length / rows.length : null,
      avgMs: avg(allDurations),
      p95Ms: percentile(allDurations, 95),
      devicesOnline: devices.filter((d) => d.online).length,
      devicesTotal: devices.length,
    },
    devices,
    buckets,
    recent,
  };
}

// For Server Components / Server Actions: redirects to /login when signed out.
export async function getServiceActivity(serviceId: string, range: ActivityRange): Promise<ServiceActivity | null> {
  const { supabase } = await requireUser();
  return loadServiceActivity(supabase, serviceId, range);
}
