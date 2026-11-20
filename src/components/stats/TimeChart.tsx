"use client";

// Small hand-rolled SVG time-series chart: stacked bars or lines over fixed-width time buckets.
// Rendered at the container's real pixel width (ResizeObserver) so strokes and text stay crisp.

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

export interface StackLayer {
  label: string;
  color: string;
  values: number[];
}

export interface Line {
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

export type ChartSeries = { kind: "stack"; layers: StackLayer[] } | { kind: "lines"; lines: Line[] };

export interface TimeChartProps {
  times: number[]; // bucket starts, epoch ms
  bucketMs: number;
  series: ChartSeries;
  format: (v: number) => string; // y-axis labels and tooltip values
  domain?: [number, number]; // fixed y domain; default [0, nice max]
  height?: number;
}

const PAD = { top: 8, right: 8, bottom: 20, left: 44 };
const GRID = "#2e2e2e";
const AXIS_TEXT = "#7a7a7a";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTick(t: number, bucketMs: number): string {
  const d = new Date(t);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return bucketMs >= 3600_000 ? `${DAYS[d.getDay()]} ${pad2(d.getHours())}h` : hm;
}

function formatRange(t: number, bucketMs: number): string {
  const a = new Date(t);
  const b = new Date(t + bucketMs);
  const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const day = bucketMs >= 3600_000 ? `${DAYS[a.getDay()]} ` : "";
  return `${day}${hm(a)} – ${hm(b)}`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export default function TimeChart({ times, bucketMs, series, format, domain, height = 140 }: TimeChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const n = times.length;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const bw = n ? plotW / n : 0;

  // y domain
  let lo = 0;
  let hi = 1;
  if (domain) {
    [lo, hi] = domain;
  } else if (series.kind === "stack") {
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, series.layers.reduce((s, l) => s + (l.values[i] ?? 0), 0));
    hi = niceMax(max);
  } else {
    let max = 0;
    for (const l of series.lines) for (const v of l.values) if (v != null) max = Math.max(max, v);
    hi = niceMax(max);
  }
  const span = hi - lo || 1;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / span) * plotH;
  const xMid = (i: number) => PAD.left + (i + 0.5) * bw;

  const ticks = [lo, lo + span / 2, hi];
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 90))));

  let body: ReactNode = null;
  if (width > 0 && n > 0) {
    if (series.kind === "stack") {
      const gap = bw > 4 ? 1 : 0;
      body = times.map((_, i) => {
        let acc = 0;
        return (
          <g key={i}>
            {series.layers.map((l) => {
              const v = l.values[i] ?? 0;
              if (!v) return null;
              const y0 = y(acc);
              acc += v;
              const y1 = y(acc);
              return (
                <rect
                  key={l.label}
                  x={PAD.left + i * bw + gap / 2}
                  y={y1}
                  width={Math.max(1, bw - gap)}
                  height={Math.max(1, y0 - y1)}
                  fill={l.color}
                  shapeRendering="crispEdges"
                />
              );
            })}
          </g>
        );
      });
    } else {
      body = series.lines.map((l) => {
        let d = "";
        const dots: ReactNode[] = [];
        for (let i = 0; i < n; i++) {
          const v = l.values[i];
          if (v == null) continue;
          const prev = i > 0 ? l.values[i - 1] : null;
          const next = i < n - 1 ? l.values[i + 1] : null;
          d += `${prev == null ? "M" : "L"}${xMid(i).toFixed(1)},${y(v).toFixed(1)}`;
          if (prev == null && next == null) dots.push(<circle key={i} cx={xMid(i)} cy={y(v)} r={2} fill={l.color} />);
        }
        return (
          <g key={l.label}>
            <path
              d={d}
              fill="none"
              stroke={l.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={l.dashed ? "3 3" : undefined}
            />
            {dots}
          </g>
        );
      });
    }
  }

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - PAD.left) / (bw || 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  const tooltipRows: { label: string; color: string; value: string }[] = [];
  if (hover != null) {
    if (series.kind === "stack") {
      const total = series.layers.reduce((s, l) => s + (l.values[hover] ?? 0), 0);
      tooltipRows.push({ label: "Total", color: "transparent", value: format(total) });
      for (const l of series.layers)
        if (l.values[hover]) tooltipRows.push({ label: l.label, color: l.color, value: format(l.values[hover]) });
    } else {
      for (const l of series.lines) {
        const v = l.values[hover];
        tooltipRows.push({ label: l.label, color: l.color, value: v == null ? "—" : format(v) });
      }
    }
  }
  const tipLeft = hover != null ? xMid(hover) : 0;
  const flip = tipLeft > width / 2;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={Math.round(y(t)) + 0.5}
                y2={Math.round(y(t)) + 0.5}
                stroke={GRID}
                strokeDasharray={i === 0 ? undefined : "2 3"}
              />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={AXIS_TEXT}>
                {format(t)}
              </text>
            </g>
          ))}
          {hover != null && (
            <rect x={PAD.left + hover * bw} y={PAD.top} width={Math.max(1, bw)} height={plotH} fill="#ffffff" opacity={0.06} />
          )}
          {body}
          {times.map((t, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={PAD.left + i * bw} y={height - 6} fontSize={10} fill={AXIS_TEXT}>
                {formatTick(t, bucketMs)}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[140px] rounded-md border border-border-strong bg-[#111]/95 px-2.5 py-2 text-[12px] shadow-lg"
          style={flip ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
        >
          <div className="mb-1 text-muted">{formatRange(times[hover], bucketMs)}</div>
          {tooltipRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="inline-block size-2 rounded-sm" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="tabular-nums text-fg">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3"
            style={
              i.dashed
                ? { backgroundImage: `linear-gradient(90deg, ${i.color} 50%, transparent 50%)`, backgroundSize: "4px 2px" }
                : { background: i.color }
            }
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
