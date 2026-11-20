"use client";

// Activity: device poll log and connection stats for one Service.
// Loads GET /api/services/<id>/activity?range=..., refreshes every 30s while the tab is visible.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Loader2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { Skeleton as Pill } from "@/components/ui/Skeleton";
import { timeAgo } from "@/lib/time";
import { ACTIVITY_RANGES, type ActivityRange, type RecentPoll, type ServiceActivity } from "@/lib/polls/types";
import TimeChart, { Legend } from "./TimeChart";

const REFRESH_MS = 30_000;

const C = {
  ok: "#3ecf8e",
  notModified: "#4f8fe8",
  disabled: "#6b6b6b",
  error: "#e5484d",
  avg: "#4f8fe8",
  p95: "#f5a524",
  data: "#a0a0a0",
  rssi: "#a78bfa",
};

const RANGE_LABEL: Record<ActivityRange, string> = { "1h": "last hour", "24h": "last 24 hours", "7d": "last 7 days" };

// ---------- formatting

function fmtMs(v: number | null): string {
  if (v == null) return "—";
  if (v >= 10_000) return `${(v / 1000).toFixed(0)} s`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)} s`;
  return `${Math.round(v)} ms`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const p = v * 100;
  return `${p === 100 || p === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
}

function fmtBytes(v: number | null): string {
  if (v == null) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
}

function fmtUptime(s: number | null): string {
  if (s == null) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtCount(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function StatusPill({ poll }: { poll: RecentPoll }) {
  const failed = poll.status >= 500 || !!poll.error;
  return (
    <Badge variant={failed ? "danger" : poll.status === 200 ? "success" : "neutral"} title={poll.error ?? undefined}>
      {poll.status}
      {poll.error && poll.status < 500 ? " · data err" : ""}
    </Badge>
  );
}

// ---------- pieces

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-bg/60 px-3 py-2.5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[18px] font-medium tabular-nums text-fg">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, legend, children }: { title: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-bg/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium text-fg">{title}</h3>
        {legend}
      </div>
      {children}
    </div>
  );
}

function RangeSwitcher({ value, onChange }: { value: ActivityRange; onChange: (r: ActivityRange) => void }) {
  return (
    <div role="tablist" aria-label="Time range" className="inline-flex rounded-md border border-border bg-bg p-0.5">
      {ACTIVITY_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={r === value}
          onClick={() => onChange(r)}
          className={cn(
            "h-6 cursor-pointer rounded px-2.5 text-[12px] font-medium transition-colors",
            r === value ? "bg-panel-hover text-fg" : "text-muted hover:text-fg",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ---------- section

export default function ActivitySection({ serviceId }: { serviceId: string }) {
  const [range, setRange] = useState<ActivityRange>("24h");
  const [data, setData] = useState<ServiceActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (r: ActivityRange) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/activity?range=${r}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error((json && json.error) || `Request failed (${res.status})`);
        setData(json as ServiceActivity);
        setError(null);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [serviceId],
  );

  useEffect(() => {
    load(range);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(range);
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(range);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
    };
  }, [range, load]);

  const shown = data; // the previous range stays on screen while a new one loads

  return (
    <section className="min-w-0 rounded-md border border-border bg-panel p-4 text-[13px] text-fg md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-medium text-fg">
            Activity
            {loading && <Loader2 size={13} className="animate-spin text-muted" aria-label="Loading" />}
          </h2>
          <p className="text-[13px] text-muted">Polls from this Service&apos;s devices, {RANGE_LABEL[range]}.</p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[#ff8a8e]">
          <AlertCircle size={14} className="shrink-0" />
          Couldn&apos;t load activity: {error}
        </div>
      )}

      {!shown ? (
        !error && <Skeleton />
      ) : shown.recent.length === 0 ? (
        <EmptyState hasDevices={shown.summary.devicesTotal > 0} />
      ) : (
        <ActivityBody data={shown} />
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Pill className="w-16" />
            <Pill className="h-4 w-10" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Pill className="w-2/3" />
        <Pill className="w-1/2" />
        <Pill className="w-3/5" />
      </div>
    </div>
  );
}

function EmptyState({ hasDevices }: { hasDevices: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-border px-6 py-10 text-center">
      <Radio size={20} className="mb-2 text-muted" />
      <p className="font-medium text-fg">No polls yet — flash a device with this Service&apos;s key</p>
      <p className="mt-1 max-w-md text-muted">
        {hasDevices
          ? "Once a device calls /api/device/frame, every poll shows up here with its status and timing."
          : "Add a device above, copy its key into the firmware, and its polls will show up here."}
      </p>
    </div>
  );
}

function ActivityBody({ data }: { data: ServiceActivity }) {
  const { summary, buckets, bucketMs, devices, recent } = data;
  const times = buckets.map((b) => b.t);
  const hasRssi = buckets.some((b) => b.avgRssi != null);
  const hasDataMs = buckets.some((b) => b.avgDataMs != null);

  let rssiDomain: [number, number] = [-100, -30];
  if (hasRssi) {
    const vals = buckets.map((b) => b.avgRssi).filter((v): v is number => v != null);
    const lo = Math.max(-120, Math.floor((Math.min(...vals) - 5) / 10) * 10);
    const hi = Math.min(0, Math.ceil((Math.max(...vals) + 5) / 10) * 10);
    rssiDomain = [lo, hi > lo ? hi : lo + 10];
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Polls" value={summary.polls.toLocaleString()} hint={RANGE_LABEL[data.range]} />
        <Tile label="Success rate" value={fmtPct(summary.successRate)} />
        <Tile label="Avg latency" value={fmtMs(summary.avgMs)} hint="server time" />
        <Tile label="p95 latency" value={fmtMs(summary.p95Ms)} hint="server time" />
        <Tile label="Devices online" value={`${summary.devicesOnline} / ${summary.devicesTotal}`} hint="seen < 2 min ago" />
      </div>

      {data.truncated && (
        <p className="text-[12px] text-muted">
          Showing stats for the most recent polls only; older polls in this range were left out.
        </p>
      )}

      {summary.polls === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-muted">
          No polls in the {RANGE_LABEL[data.range]}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ChartCard
            title="Polls"
            legend={
              <Legend
                items={[
                  { label: "200", color: C.ok },
                  { label: "304", color: C.notModified },
                  { label: "204", color: C.disabled },
                  { label: "Error", color: C.error },
                ]}
              />
            }
          >
            <TimeChart
              times={times}
              bucketMs={bucketMs}
              format={fmtCount}
              series={{
                kind: "stack",
                layers: [
                  { label: "200", color: C.ok, values: buckets.map((b) => b.ok) },
                  { label: "304", color: C.notModified, values: buckets.map((b) => b.notModified) },
                  { label: "204", color: C.disabled, values: buckets.map((b) => b.disabled) },
                  { label: "Error", color: C.error, values: buckets.map((b) => b.error) },
                ],
              }}
            />
          </ChartCard>

          <ChartCard
            title="Server latency"
            legend={
              <Legend
                items={[
                  { label: "avg", color: C.avg },
                  { label: "p95", color: C.p95 },
                  ...(hasDataMs ? [{ label: "data avg", color: C.data, dashed: true }] : []),
                ]}
              />
            }
          >
            <TimeChart
              times={times}
              bucketMs={bucketMs}
              format={fmtMs}
              series={{
                kind: "lines",
                lines: [
                  ...(hasDataMs
                    ? [{ label: "data avg", color: C.data, dashed: true, values: buckets.map((b) => b.avgDataMs) }]
                    : []),
                  { label: "avg", color: C.avg, values: buckets.map((b) => b.avgMs) },
                  { label: "p95", color: C.p95, values: buckets.map((b) => b.p95Ms) },
                ],
              }}
            />
          </ChartCard>

          {hasRssi && (
            <ChartCard title="WiFi signal" legend={<Legend items={[{ label: "avg RSSI", color: C.rssi }]} />}>
              <TimeChart
                times={times}
                bucketMs={bucketMs}
                format={(v) => `${Math.round(v)} dBm`}
                domain={rssiDomain}
                series={{ kind: "lines", lines: [{ label: "RSSI", color: C.rssi, values: buckets.map((b) => b.avgRssi) }] }}
              />
            </ChartCard>
          )}
        </div>
      )}

      <DeviceTable devices={devices} />
      <RecentList recent={recent} />
    </div>
  );
}

const th = "px-3 py-2 text-left font-medium text-muted whitespace-nowrap";
const td = "px-3 py-2 whitespace-nowrap tabular-nums";

function DeviceTable({ devices }: { devices: ServiceActivity["devices"] }) {
  if (!devices.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-fg">Devices</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-[12.5px]">
          <thead className="border-b border-border bg-bg/60">
            <tr>
              <th className={th}>Device</th>
              <th className={th}>Last seen</th>
              <th className={cn(th, "text-right")}>Polls</th>
              <th className={cn(th, "text-right")}>Success</th>
              <th className={cn(th, "text-right")}>Avg</th>
              <th className={cn(th, "text-right")}>p95</th>
              <th className={cn(th, "text-right")}>RSSI</th>
              <th className={cn(th, "text-right")}>Free heap</th>
              <th className={cn(th, "text-right")}>Uptime</th>
              <th className={th}>Firmware</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-panel-hover">
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("inline-block size-2 rounded-full", d.online ? "bg-accent" : "bg-[#555]")}
                      title={d.online ? "Online" : "Offline"}
                    />
                    <span className="max-w-[180px] truncate text-fg" title={d.ip ? `${d.name} · ${d.ip}` : d.name}>
                      {d.name}
                    </span>
                  </span>
                </td>
                <td className={cn(td, "text-muted")} title={d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : undefined}>
                  {d.lastSeenAt ? timeAgo(d.lastSeenAt) : "never"}
                </td>
                <td className={cn(td, "text-right")}>{d.polls.toLocaleString()}</td>
                <td
                  className={cn(td, "text-right", d.successRate != null && d.successRate < 0.95 && "text-[#ff8a8e]")}
                >
                  {fmtPct(d.successRate)}
                </td>
                <td className={cn(td, "text-right")}>{fmtMs(d.avgMs)}</td>
                <td className={cn(td, "text-right")}>{fmtMs(d.p95Ms)}</td>
                <td className={cn(td, "text-right")}>{d.rssi == null ? "—" : `${d.rssi} dBm`}</td>
                <td className={cn(td, "text-right")}>{fmtBytes(d.heap)}</td>
                <td className={cn(td, "text-right")}>{fmtUptime(d.uptimeS)}</td>
                <td className={cn(td, "font-mono text-muted")}>{d.fw ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentList({ recent }: { recent: RecentPoll[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-fg">Recent polls</h3>
      <div className="max-h-[360px] overflow-auto rounded-md border border-border">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 border-b border-border bg-[#1a1a1a]">
            <tr>
              <th className={th}>Time</th>
              <th className={th}>Device</th>
              <th className={th}>Status</th>
              <th className={cn(th, "text-right")}>Duration</th>
              <th className={cn(th, "text-right")}>Data</th>
              <th className={cn(th, "text-right")}>Size</th>
              <th className={th}>Error</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-panel-hover">
                <td className={cn(td, "text-muted")} title={new Date(p.at).toLocaleString()}>
                  {fmtTime(p.at)}
                </td>
                <td className="max-w-[160px] truncate px-3 py-2 whitespace-nowrap">{p.deviceName}</td>
                <td className="px-3 py-2">
                  <StatusPill poll={p} />
                </td>
                <td className={cn(td, "text-right")}>{fmtMs(p.durationMs)}</td>
                <td className={cn(td, "text-right text-muted")}>{fmtMs(p.dataMs)}</td>
                <td
                  className={cn(td, "text-right")}
                  title={p.ops != null ? `${p.ops} draw command${p.ops === 1 ? "" : "s"}` : undefined}
                >
                  {p.status === 200 ? fmtBytes(p.bytes) : "—"}
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 text-[#ff8a8e]" title={p.error ?? undefined}>
                  {p.error ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
