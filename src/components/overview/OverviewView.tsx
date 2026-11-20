"use client";

// Overview: account-wide poll activity across every Service the user can access.
// Loads GET /api/overview?range=..., refreshes every 30s while the tab is visible.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Loader2, Users } from "lucide-react";
import TimeChart, { Legend } from "@/components/stats/TimeChart";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { timeAgo } from "@/lib/time";
import { ACTIVITY_RANGES, type ActivityRange } from "@/lib/polls/types";
import { POLLS_PER_DEVICE_MONTH_30S, type Overview, type OverviewService } from "@/lib/overview/types";

const REFRESH_MS = 30_000;

const C = {
  ok: "#3ecf8e",
  notModified: "#4f8fe8",
  disabled: "#6b6b6b",
  error: "#e5484d",
  avg: "#4f8fe8",
  p95: "#f5a524",
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

function fmtCount(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

// ---------- pieces

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-panel px-3 py-2.5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[18px] font-medium tabular-nums text-fg">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-panel p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-fg">{title}</h2>
        {aside}
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

// ---------- view

export default function OverviewView() {
  const [range, setRange] = useState<ActivityRange>("24h");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (r: ActivityRange) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const res = await fetch(`/api/overview?range=${r}`, { signal: ac.signal, cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || `Request failed (${res.status})`);
      setData(json as Overview);
      setError(null);
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

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

  return (
    <div className="text-[13px] text-fg">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-medium">
            Overview
            {loading && <Loader2 size={14} className="animate-spin text-muted" aria-label="Loading" />}
          </h1>
          <p className="text-muted">Device polls across all your Services, {RANGE_LABEL[range]}.</p>
        </div>
        <RangeSwitcher value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[#ff8a8e]">
          <AlertCircle size={14} className="shrink-0" />
          Couldn&apos;t load overview: {error}
        </div>
      )}

      {data ? <OverviewBody data={data} /> : !error && <Skeleton />}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[62px] animate-pulse rounded-md border border-border bg-panel" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-[186px] animate-pulse rounded-md border border-border bg-panel" />
        <div className="h-[186px] animate-pulse rounded-md border border-border bg-panel" />
      </div>
    </div>
  );
}

function OverviewBody({ data }: { data: Overview }) {
  const { summary, buckets, bucketMs } = data;
  const times = buckets.map((b) => b.t);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Polls" value={summary.polls.toLocaleString()} hint={RANGE_LABEL[data.range]} />
        <Tile label="Success rate" value={fmtPct(summary.successRate)} />
        <Tile label="Avg latency" value={fmtMs(summary.avgMs)} hint="server time" />
        <Tile label="p95 latency" value={fmtMs(summary.p95Ms)} hint="server time" />
        <Tile
          label="Devices online"
          value={`${summary.devicesOnline} / ${summary.devicesTotal}`}
          hint="seen < 2 min ago"
        />
        <Tile label="Services enabled" value={`${summary.servicesEnabled} / ${summary.servicesTotal}`} />
      </div>

      {data.truncated && (
        <p className="text-[12px] text-muted">
          This range has {summary.polls.toLocaleString()} polls; rates, latency and charts use the newest{" "}
          {data.fetched.toLocaleString()}. Poll counts are exact.
        </p>
      )}

      {summary.polls === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-panel px-3 py-6 text-center text-muted">
          No polls in the {RANGE_LABEL[data.range]}.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card
            title="Polls"
            aside={
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
          </Card>

          <Card
            title="Server latency"
            aside={
              <Legend
                items={[
                  { label: "avg", color: C.avg },
                  { label: "p95", color: C.p95 },
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
                  { label: "avg", color: C.avg, values: buckets.map((b) => b.avgMs) },
                  { label: "p95", color: C.p95, values: buckets.map((b) => b.p95Ms) },
                ],
              }}
            />
          </Card>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ServiceTable services={data.services} range={data.range} />
        </div>
        <BudgetCard data={data} />
      </div>
    </div>
  );
}

const th = "px-3 py-2 text-left font-medium text-muted whitespace-nowrap";
const td = "px-3 py-2 whitespace-nowrap tabular-nums";

function ServiceTable({ services, range }: { services: OverviewService[]; range: ActivityRange }) {
  return (
    <Card title="Services" aside={<span className="text-[12px] text-muted">{RANGE_LABEL[range]}</span>}>
      {services.length === 0 ? (
        <p className="px-3 py-6 text-center text-muted">
          No Services yet.{" "}
          <Link href="/" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          to start.
        </p>
      ) : (
        <div className="-mx-3 -mb-3 overflow-x-auto border-t border-border">
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-border bg-bg/60">
              <tr>
                <th className={th}>Service</th>
                <th className={cn(th, "text-right")}>Devices</th>
                <th className={cn(th, "text-right")}>Polls</th>
                <th className={cn(th, "text-right")}>Success</th>
                <th className={cn(th, "text-right")}>Avg</th>
                <th className={cn(th, "text-right")}>Errors</th>
                <th className={th}>Last poll</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-panel-hover">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/services/${s.id}`}
                        className="max-w-[200px] truncate text-fg hover:text-accent hover:underline"
                        title={s.name}
                      >
                        {s.name}
                      </Link>
                      {!s.enabled && <Badge>Disabled</Badge>}
                      {s.shared && (
                        <Badge className="gap-1" title="Shared with you" aria-label="Shared with you">
                          <Users size={11} />
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className={cn(td, "text-right")} title={`${s.devicesOnline} online`}>
                    {s.devices}
                  </td>
                  <td className={cn(td, "text-right")}>{s.polls.toLocaleString()}</td>
                  <td
                    className={cn(td, "text-right", s.successRate != null && s.successRate < 0.95 && "text-[#ff8a8e]")}
                  >
                    {fmtPct(s.successRate)}
                  </td>
                  <td className={cn(td, "text-right")}>{fmtMs(s.avgMs)}</td>
                  <td className={cn(td, "text-right", s.errors > 0 && "text-[#ff8a8e]")}>{s.errors.toLocaleString()}</td>
                  <td
                    className={cn(td, "text-muted")}
                    title={s.lastPollAt ? new Date(s.lastPollAt).toLocaleString() : undefined}
                  >
                    {s.lastPollAt ? timeAgo(s.lastPollAt) : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BudgetCard({ data }: { data: Overview }) {
  const { estimatedPerMonth, limit, polls7d, devicesThatFit } = data.budget;
  const ratio = estimatedPerMonth / limit;
  const pct = Math.min(100, ratio * 100);
  const barColor = ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-[#f5a524]" : "bg-accent";

  return (
    <Card title="Vercel free-tier budget">
      <div className="text-[12px] text-muted">Estimated device polls per month</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[18px] font-medium tabular-nums">{estimatedPerMonth.toLocaleString()}</span>
        <span className="text-muted">/ {limit.toLocaleString()}</span>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-bg"
        role="progressbar"
        aria-label="Share of monthly Hobby invocation limit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.max(pct, estimatedPerMonth ? 1 : 0)}%` }} />
      </div>
      <div className={cn("mt-1 text-[12px] tabular-nums", ratio >= 1 ? "text-[#ff8a8e]" : "text-muted")}>
        {fmtPct(ratio)} of the Hobby limit
        {ratio >= 1 && " — over the limit"}
      </div>

      <ul className="mt-3 space-y-1.5 text-[12px] text-muted">
        <li>
          Method: {polls7d.toLocaleString()} polls in the last 7 days × 30 / 7. Each poll is one function invocation; the
          Hobby plan includes {limit.toLocaleString()} per month.
        </li>
        <li>
          About {devicesThatFit} devices polling every 30 s fit (one device ≈ {POLLS_PER_DEVICE_MONTH_30S.toLocaleString()}{" "}
          polls/month).
        </li>
        <li>Using this dashboard (pages, previews, refreshes) adds a little on top.</li>
      </ul>
    </Card>
  );
}
