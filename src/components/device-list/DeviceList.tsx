"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cpu, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { timeAgo } from "@/lib/time";
import { formatBytes, formatUptime, signalBars, type DeviceListRow } from "@/lib/device-list/types";

type Filter = "all" | "online" | "offline";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

const dash = <span className="text-muted/50">—</span>;

function SignalBars({ rssi }: { rssi: number }) {
  const bars = signalBars(rssi);
  return (
    <span className="inline-flex items-center gap-1.5" title={`${rssi} dBm`}>
      <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("w-[3px] rounded-[1px]", i <= bars ? "bg-accent" : "bg-border-strong")}
            style={{ height: `${i * 25}%` }}
          />
        ))}
      </span>
      <span className="tabular-nums">{rssi} dBm</span>
    </span>
  );
}

function StatusBadge({ status, error }: { status: number; error: string | null }) {
  const failed = status >= 500 || !!error;
  return (
    <Badge variant={failed ? "danger" : status === 200 ? "success" : "neutral"} title={error ?? undefined}>
      {status}
      {error && status < 500 ? " · data err" : ""}
    </Badge>
  );
}

export default function DeviceList({ devices, now }: { devices: DeviceListRow[]; now: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (filter === "online" && !d.online) return false;
      if (filter === "offline" && d.online) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.serviceName.toLowerCase().includes(q) ||
        (d.fw?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [devices, query, filter]);

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-6 py-16 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted">
          <Cpu size={18} />
        </span>
        <h2 className="mb-1 text-sm font-medium">No devices yet</h2>
        <p className="mb-5 max-w-sm text-[13px] text-muted">
          Devices are added to a Service. Open a Service and use <span className="text-fg">Add device</span> to get a
          device key for your ESP32.
        </p>
        <Link
          href="/"
          className="inline-flex h-8 items-center rounded-md border border-accent bg-accent px-3 text-sm font-medium text-[#111] transition-colors hover:border-accent-hover hover:bg-accent-hover"
        >
          Go to Services
        </Link>
      </div>
    );
  }

  const counts = { all: devices.length, online: devices.filter((d) => d.online).length } as Record<Filter, number>;
  counts.offline = counts.all - counts.online;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices, services, firmware"
            aria-label="Search devices"
            className="pl-8"
          />
        </div>
        <div className="inline-flex rounded-md border border-border bg-panel p-0.5" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded px-2.5 py-1 text-[12px] transition-colors",
                filter === f.value ? "bg-panel-hover text-fg" : "text-muted hover:text-fg",
              )}
            >
              {f.label} <span className="tabular-nums text-muted">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-panel">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-[12px] text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Device</th>
              <th className="px-4 py-2 font-normal">Service</th>
              <th className="px-4 py-2 font-normal">Last seen</th>
              <th className="px-4 py-2 font-normal">Firmware</th>
              <th className="px-4 py-2 font-normal">WiFi</th>
              <th className="px-4 py-2 text-right font-normal">Free heap</th>
              <th className="px-4 py-2 text-right font-normal">Uptime</th>
              <th className="px-4 py-2 font-normal">Last status</th>
              <th className="px-4 py-2 text-right font-normal">Polls 24h</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-panel-hover">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", d.online ? "bg-accent" : "bg-muted/40")}
                      title={d.online ? "Online" : "Offline"}
                    />
                    <span className="truncate font-medium">{d.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <Link href={`/services/${d.serviceId}`} className="truncate text-muted hover:text-fg hover:underline">
                      {d.serviceName}
                    </Link>
                    {d.shared && (
                      <span title="Shared with you" className="text-muted">
                        <Users size={12} />
                      </span>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {d.lastSeenAt ? (
                    <span title={new Date(d.lastSeenAt).toLocaleString()}>{timeAgo(d.lastSeenAt, now)}</span>
                  ) : (
                    "Never"
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px]">{d.fw ?? dash}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{d.rssi != null ? <SignalBars rssi={d.rssi} /> : dash}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {d.heap != null ? formatBytes(d.heap) : dash}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {d.uptimeS != null ? formatUptime(d.uptimeS) : dash}
                </td>
                <td className="px-4 py-2.5">
                  {d.lastStatus != null ? <StatusBadge status={d.lastStatus} error={d.lastError} /> : dash}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{d.polls24h.toLocaleString("en")}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-muted">
                  No devices match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
