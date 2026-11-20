// Account-wide poll stats for /overview, across every Service the user can access.
// Reads with the signed-in user's client, so RLS (can_access_service) scopes everything.
// Rows are fetched in pages (PostgREST caps a response at 1000 rows), newest first, up to MAX_ROWS;
// counts (total, per Service, 7-day budget) are exact via count queries.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityRange } from "@/lib/polls/types";
import {
  HOBBY_INVOCATIONS_PER_MONTH,
  POLLS_PER_DEVICE_MONTH_30S,
  type Overview,
  type OverviewBucket,
  type OverviewService,
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
const MAX_ROWS = 50_000; // ~2.5 devices polling every 30s for 7 days
const PARALLEL_PAGES = 8;
const ONLINE_MS = 2 * 60_000;
const WEEK_MS = 7 * 86400_000;

interface PollRow {
  id: number;
  service_id: string;
  at: string;
  status: number;
  duration_ms: number;
  error: string | null;
}

interface ServiceRow {
  id: string;
  name: string;
  owner_id: string;
  enabled: boolean;
  devices: { id: string; last_seen_at: string | null }[];
}

const POLL_COLS = "id, service_id, at, status, duration_ms, error";

const isSuccess = (r: { status: number; error: string | null }) =>
  (r.status === 200 || r.status === 204 || r.status === 304) && !r.error;
const isError = (r: { status: number; error: string | null }) =>
  !!r.error || !(r.status === 200 || r.status === 204 || r.status === 304);

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// Nearest-rank percentile.
function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

async function countPolls(supabase: SupabaseClient, fromIso: string, serviceId?: string): Promise<number> {
  let q = supabase.from("device_polls").select("id", { count: "exact", head: true }).gte("at", fromIso);
  if (serviceId) q = q.eq("service_id", serviceId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchPolls(
  supabase: SupabaseClient,
  fromIso: string,
): Promise<{ rows: PollRow[]; total: number; truncated: boolean }> {
  const query = () =>
    supabase
      .from("device_polls")
      .select(POLL_COLS, { count: "exact" })
      .gte("at", fromIso)
      .order("at", { ascending: false })
      .order("id", { ascending: false });

  const first = await query().range(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = (first.data ?? []) as PollRow[];
  const total = first.count ?? rows.length;
  const want = Math.min(total, MAX_ROWS);

  const offsets: number[] = [];
  for (let offset = PAGE; offset < want; offset += PAGE) offsets.push(offset);
  for (let i = 0; i < offsets.length; i += PARALLEL_PAGES) {
    const pages = await Promise.all(
      offsets.slice(i, i + PARALLEL_PAGES).map(async (offset) => {
        const res = await query().range(offset, Math.min(offset + PAGE, want) - 1);
        if (res.error) throw new Error(res.error.message);
        return (res.data ?? []) as PollRow[];
      }),
    );
    for (const page of pages) rows.push(...page);
  }

  // Offsets can shift if polls arrive between pages; drop duplicates.
  const seen = new Set<number>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  return { rows: unique, total: Math.max(total, unique.length), truncated: total > MAX_ROWS };
}

export async function loadOverview(supabase: SupabaseClient, userId: string, range: ActivityRange): Promise<Overview> {
  const now = Date.now();
  const bucketMs = BUCKET_MS[range];
  // Align buckets to bucket boundaries; the first bucket may start slightly before the range.
  const lastStart = Math.floor(now / bucketMs) * bucketMs;
  const bucketCount = Math.round(RANGE_MS[range] / bucketMs);
  const firstStart = lastStart - (bucketCount - 1) * bucketMs;
  const fromIso = new Date(firstStart).toISOString();

  const [servicesRes, pollsRes, polls7d] = await Promise.all([
    supabase.from("services").select("id, name, owner_id, enabled, devices(id, last_seen_at)").order("name"),
    fetchPolls(supabase, fromIso),
    countPolls(supabase, new Date(now - WEEK_MS).toISOString()),
  ]);
  if (servicesRes.error) throw new Error(servicesRes.error.message);
  const serviceRows = (servicesRes.data ?? []) as ServiceRow[];
  const { rows, total, truncated } = pollsRes;

  // Group fetched polls by Service.
  const byService = new Map<string, PollRow[]>();
  for (const r of rows) {
    const list = byService.get(r.service_id);
    if (list) list.push(r);
    else byService.set(r.service_id, [r]);
  }

  // When truncated, fetched rows undercount older Services' polls; get exact counts instead.
  const exactCounts = new Map<string, number>();
  if (truncated) {
    const counts = await Promise.all(serviceRows.map((s) => countPolls(supabase, fromIso, s.id)));
    serviceRows.forEach((s, i) => exactCounts.set(s.id, counts[i]));
  }

  const isOnline = (d: { last_seen_at: string | null }) =>
    !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_MS;

  const services: OverviewService[] = serviceRows.map((s) => {
    const polls = byService.get(s.id) ?? [];
    const devices = s.devices ?? [];
    let lastPollAt: string | null = null;
    for (const d of devices) if (d.last_seen_at && (!lastPollAt || d.last_seen_at > lastPollAt)) lastPollAt = d.last_seen_at;
    return {
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      shared: s.owner_id !== userId,
      devices: devices.length,
      devicesOnline: devices.filter(isOnline).length,
      polls: exactCounts.get(s.id) ?? polls.length,
      successRate: polls.length ? polls.filter(isSuccess).length / polls.length : null,
      avgMs: avg(polls.map((p) => p.duration_ms)),
      errors: polls.filter(isError).length,
      lastPollAt,
    };
  });

  // Time buckets.
  const groups: PollRow[][] = Array.from({ length: bucketCount }, () => []);
  for (const r of rows) {
    const i = Math.floor((new Date(r.at).getTime() - firstStart) / bucketMs);
    if (i >= 0 && i < bucketCount) groups[i].push(r);
  }
  const buckets: OverviewBucket[] = groups.map((g, i) => {
    const durations = g.map((r) => r.duration_ms);
    let ok = 0, notModified = 0, disabled = 0, error = 0;
    for (const r of g) {
      if (r.status >= 500 || r.error) error++;
      else if (r.status === 304) notModified++;
      else if (r.status === 204) disabled++;
      else if (r.status === 200) ok++;
      else error++;
    }
    return { t: firstStart + i * bucketMs, count: g.length, ok, notModified, disabled, error, avgMs: avg(durations), p95Ms: percentile(durations, 95) };
  });

  const allDevices = serviceRows.flatMap((s) => s.devices ?? []);
  const durations = rows.map((r) => r.duration_ms);
  const estimatedPerMonth = Math.round((polls7d * 30) / 7);

  return {
    range,
    from: firstStart,
    to: now,
    bucketMs,
    generatedAt: new Date(now).toISOString(),
    truncated,
    fetched: rows.length,
    summary: {
      polls: total,
      successRate: rows.length ? rows.filter(isSuccess).length / rows.length : null,
      avgMs: avg(durations),
      p95Ms: percentile(durations, 95),
      devicesOnline: allDevices.filter(isOnline).length,
      devicesTotal: allDevices.length,
      servicesEnabled: serviceRows.filter((s) => s.enabled).length,
      servicesTotal: serviceRows.length,
    },
    buckets,
    services,
    budget: {
      polls7d,
      estimatedPerMonth,
      limit: HOBBY_INVOCATIONS_PER_MONTH,
      devicesThatFit: Math.floor(HOBBY_INVOCATIONS_PER_MONTH / POLLS_PER_DEVICE_MONTH_30S),
    },
  };
}
