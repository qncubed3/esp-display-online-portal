// Data for the /devices page: the signed-in user's own devices, subscribed to a Service or not,
// with the latest logged poll and the number of polls in the last 24 hours.
// Other people's devices on shared Services are listed on those Services' Devices tabs instead.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeviceListRow } from "./types";

const ONLINE_MS = 2 * 60_000;
const DAY_MS = 86_400_000;
const PAGE = 1000; // PostgREST caps a response at 1000 rows
const RECENT_POLLS = 1000; // newest polls scanned for "latest per device"
const MAX_COUNT_ROWS = 20_000; // above this, count per device with head queries instead
const LATEST_COLS = "device_id, at, status, error, fw, rssi, heap, uptime_s";

interface DeviceDbRow {
  id: string;
  name: string;
  service_id: string | null;
  last_seen_at: string | null;
  created_at: string;
  poll_seconds?: number | null; // missing until migration 006 has run
  services: { id: string; name: string; owner_id: string } | null;
}

interface LatestPollRow {
  device_id: string;
  at: string;
  status: number;
  error: string | null;
  fw: string | null;
  rssi: number | null;
  heap: number | null;
  uptime_s: number | null;
}

// Latest poll per device: one scan of the newest polls, then a single-row lookup for any
// device that has been seen but polled too long ago to be in that scan.
async function latestPolls(supabase: SupabaseClient, devices: DeviceDbRow[]): Promise<Map<string, LatestPollRow>> {
  const latest = new Map<string, LatestPollRow>();
  const { data, error } = await supabase
    .from("device_polls")
    .select(LATEST_COLS)
    .order("at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_POLLS);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as LatestPollRow[]) if (!latest.has(r.device_id)) latest.set(r.device_id, r);

  const missing = devices.filter((d) => d.last_seen_at && !latest.has(d.id));
  const results = await Promise.all(
    missing.map((d) =>
      supabase
        .from("device_polls")
        .select(LATEST_COLS)
        .eq("device_id", d.id)
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );
  for (const res of results) {
    const r = res.data as LatestPollRow | null;
    if (r) latest.set(r.device_id, r);
  }
  return latest;
}

// Polls per device since `fromIso`. Fetches device_id only, in parallel pages; if there are
// too many rows, falls back to one indexed count query per device.
async function pollCounts(
  supabase: SupabaseClient,
  devices: DeviceDbRow[],
  fromIso: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const query = () =>
    supabase.from("device_polls").select("id, device_id", { count: "exact" }).gte("at", fromIso).order("id");

  const first = await query().range(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const total = first.count ?? 0;

  if (total > MAX_COUNT_ROWS) {
    const results = await Promise.all(
      devices.map((d) =>
        supabase
          .from("device_polls")
          .select("id", { count: "exact", head: true })
          .eq("device_id", d.id)
          .gte("at", fromIso),
      ),
    );
    devices.forEach((d, i) => counts.set(d.id, results[i].count ?? 0));
    return counts;
  }

  const rows = [...((first.data ?? []) as { id: number; device_id: string }[])];
  const pages = [];
  for (let offset = PAGE; offset < total; offset += PAGE) pages.push(query().range(offset, offset + PAGE - 1));
  for (const res of await Promise.all(pages)) {
    if (res.error) throw new Error(res.error.message);
    rows.push(...((res.data ?? []) as { id: number; device_id: string }[]));
  }
  // Ordered by id, so new polls arriving between pages land at the end; dedupe anyway.
  const seen = new Set<number>();
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    counts.set(r.device_id, (counts.get(r.device_id) ?? 0) + 1);
  }
  return counts;
}

export async function loadDeviceList(supabase: SupabaseClient, userId: string): Promise<DeviceListRow[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("*, services(id, name, owner_id)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const devices = (data ?? []) as unknown as DeviceDbRow[];
  if (!devices.length) return [];

  const now = Date.now();
  const [latest, counts] = await Promise.all([
    latestPolls(supabase, devices),
    pollCounts(supabase, devices, new Date(now - DAY_MS).toISOString()),
  ]);

  return devices
    .map((d): DeviceListRow => {
      const p = latest.get(d.id);
      return {
        id: d.id,
        name: d.name,
        serviceId: d.service_id,
        serviceName: d.services?.name ?? null,
        shared: !!d.services && d.services.owner_id !== userId,
        pollSeconds: d.poll_seconds ?? 30,
        lastSeenAt: d.last_seen_at,
        online: !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_MS,
        polls24h: counts.get(d.id) ?? 0,
        fw: p?.fw ?? null,
        rssi: p?.rssi ?? null,
        heap: p?.heap ?? null,
        uptimeS: p?.uptime_s ?? null,
        lastStatus: p?.status ?? null,
        lastError: p?.error ?? null,
        lastPollAt: p?.at ?? null,
      };
    })
    .sort((a, b) => {
      // Online first, then most recently seen, then name.
      if (a.online !== b.online) return a.online ? -1 : 1;
      const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return tb - ta || a.name.localeCompare(b.name);
    });
}
