"use client";

import ServiceLink from "@/components/services/ServiceLink";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Cpu, ExternalLink, FileCode2, Info, KeyRound, Loader2, Plus, Search, Trash2 } from "lucide-react";
import LivePreviewButton from "@/components/devices/LivePreviewButton";
import SetupFilesDialog from "@/components/devices/SetupFilesDialog";
import { AddDeviceForm, NewKeyCallout, NextPollCountdown, PollFrequency, ServiceSelect } from "@/components/devices/DeviceControls";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { addDevice, deleteDevice, regenerateDeviceKey, type SubscribableService } from "@/lib/devices/actions";
import { timeAgo } from "@/lib/time";
import { formatBytes, formatUptime, signalBars, type DeviceListRow } from "@/lib/device-list/types";

type Filter = "all" | "online" | "offline";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

const dash = <span className="text-muted/50">—</span>;

const iconButton = "rounded-md p-1.5 text-muted hover:bg-panel-hover hover:text-fg disabled:opacity-50";

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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

// The rest of a device's details, behind the row's Info button.
function DeviceInfoButton({ d, now }: { d: DeviceListRow; now: number }) {
  const [open, setOpen] = useState(false);
  const when = (iso: string | null) =>
    iso ? <span title={new Date(iso).toLocaleString()}>{timeAgo(iso, now)}</span> : "Never";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Device details"
        aria-label={`Details for ${d.name}`}
        className={iconButton}
      >
        <Info size={13} />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={d.name}>
        <dl className="divide-y divide-border text-[13px]">
          <InfoRow label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", d.online ? "bg-accent" : "bg-muted/40")} />
              {d.online ? "Online" : "Offline"}
            </span>
          </InfoRow>
          <InfoRow label="Service">
            {d.serviceName ? `${d.serviceName}${d.shared ? " (shared with you)" : ""}` : "No service"}
          </InfoRow>
          <InfoRow label="Update frequency">{d.pollSeconds < 60 ? `${d.pollSeconds} s` : `${d.pollSeconds / 60} min`}</InfoRow>
          <InfoRow label="Last seen">{when(d.lastSeenAt)}</InfoRow>
          <InfoRow label="Last logged poll">{when(d.lastPollAt)}</InfoRow>
          <InfoRow label="Last result">
            {d.lastStatus != null ? <StatusBadge status={d.lastStatus} error={d.lastError} /> : dash}
          </InfoRow>
          {d.lastError && (
            <div className="py-2">
              <dt className="mb-1 text-muted">Last error</dt>
              <dd className="break-words font-mono text-[12px] text-[#ff8a8e]">{d.lastError}</dd>
            </div>
          )}
          <InfoRow label="Polls in the last 24 h">{d.polls24h.toLocaleString("en")}</InfoRow>
          <InfoRow label="Firmware">{d.fw ? <span className="font-mono text-[12px]">{d.fw}</span> : dash}</InfoRow>
          <InfoRow label="WiFi signal">
            {d.rssi != null ? (
              <span className="inline-flex items-center gap-2">
                <SignalBars rssi={d.rssi} />
              </span>
            ) : (
              dash
            )}
          </InfoRow>
          <InfoRow label="Free memory">{d.heap != null ? formatBytes(d.heap) : dash}</InfoRow>
          <InfoRow label="Uptime">{d.uptimeS != null ? formatUptime(d.uptimeS) : dash}</InfoRow>
          <InfoRow label="Device ID">
            <span className="font-mono text-[12px] text-muted">{d.id}</span>
          </InfoRow>
        </dl>
      </Dialog>
    </>
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

// The signed-in user's devices: add them, choose the Service each one shows, poll frequency, keys.
// Changing the Service needs no reflashing; the device gets the new screen on its next poll.
export default function DeviceList({
  devices,
  services,
  now,
}: {
  devices: DeviceListRow[];
  services: SubscribableService[];
  now: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // device id or "add"
  const [error, setError] = useState<string | null>(null);
  const [shownKey, setShownKey] = useState<{ name: string; key: string } | null>(null);
  // Setup files dialog: key is set when opened from the one-time key callout.
  const [filesFor, setFilesFor] = useState<{ name: string; key?: string } | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (filter === "online" && !d.online) return false;
      if (filter === "offline" && d.online) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.serviceName ?? "no service").toLowerCase().includes(q) ||
        (d.fw?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [devices, query, filter]);

  async function run<T>(id: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(id);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onAdd(name: string, serviceId: string | null) {
    const res = await run("add", () => addDevice(name, serviceId));
    if (res) {
      setShownKey({ name, key: res.key });
      setAdding(false);
      router.refresh();
    }
  }

  async function onRegenerate(d: DeviceListRow) {
    if (!confirm(`Regenerate the key for "${d.name}"? The current key stops working immediately.`)) return;
    const key = await run(d.id, () => regenerateDeviceKey(d.id));
    if (key) setShownKey({ name: d.name, key });
  }

  async function onDelete(d: DeviceListRow) {
    if (!confirm(`Delete device "${d.name}"? It will no longer be able to fetch frames.`)) return;
    await run(d.id, () => deleteDevice(d.id));
    router.refresh();
  }

  // Add form, one-time key and errors, above the table (or the empty state).
  const panels =
    adding || shownKey || error ? (
      <div className="mb-3 space-y-3">
        {adding && (
          <AddDeviceForm
            services={services}
            busy={busy === "add"}
            onSubmit={(name, serviceId) => void onAdd(name, serviceId)}
            onCancel={() => setAdding(false)}
          />
        )}
        {shownKey && (
          <NewKeyCallout
            deviceName={shownKey.name}
            keyValue={shownKey.key}
            onClose={() => setShownKey(null)}
            onSetupFiles={() => setFilesFor({ name: shownKey.name, key: shownKey.key })}
          />
        )}
        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">{error}</p>
        )}
      </div>
    ) : null;

  const filesDialog = filesFor && (
    <SetupFilesDialog deviceName={filesFor.name} deviceKey={filesFor.key} onClose={() => setFilesFor(null)} />
  );

  if (devices.length === 0) {
    return (
      <div>
        {panels}
        {filesDialog}
        {!adding && (
          <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-6 py-16 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted">
              <Cpu size={18} />
            </span>
            <h2 className="mb-1 text-sm font-medium">No devices yet</h2>
            <p className="mb-5 max-w-sm text-[13px] text-muted">
              Add a device to get a key for your ESP32, then choose which Service it shows. You can switch Services any
              time without reflashing.
            </p>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add device
            </Button>
          </div>
        )}
      </div>
    );
  }

  const counts = { all: devices.length, online: devices.filter((d) => d.online).length } as Record<Filter, number>;
  counts.offline = counts.all - counts.online;

  return (
    <div>
      {panels}
      {filesDialog}
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
        {!adding && (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add device
          </Button>
        )}
      </div>

      {/* Scrolls sideways inside the card on narrow screens instead of widening the page. */}
      <div className="overflow-x-auto rounded-md border border-border bg-panel">
        <table className="w-full text-left text-[13px]">
          <thead className="whitespace-nowrap border-b border-border text-[12px] text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Device</th>
              <th className="px-4 py-2 font-normal">Service</th>
              <th className="px-4 py-2 font-normal">Update frequency</th>
              <th className="px-4 py-2 font-normal">Last seen</th>
              <th className="px-4 py-2 font-normal">Next update</th>
              <th className="px-4 py-2 font-normal">Status</th>
              <th className="w-px px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
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
                    <span className="max-w-[14rem] truncate font-medium" title={d.name}>
                      {d.name}
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-1.5">
                  <span className="flex items-center gap-1">
                    <ServiceSelect
                      key={d.serviceId ?? ""}
                      deviceId={d.id}
                      initial={d.serviceId}
                      services={services}
                      onChanged={() => router.refresh()}
                    />
                    {d.serviceId && d.serviceName ? (
                      <ServiceLink
                        service={{ id: d.serviceId, name: d.serviceName, shared: d.shared }}
                        title={`Open ${d.serviceName}${d.shared ? " (shared with you)" : ""}`}
                        aria-label={`Open ${d.serviceName}`}
                        className={iconButton}
                      >
                        <ExternalLink size={12} />
                      </ServiceLink>
                    ) : (
                      // Same width as the link, so the columns line up row to row.
                      <span className="w-6 shrink-0" aria-hidden />
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-1.5">
                  <PollFrequency key={d.pollSeconds} deviceId={d.id} initial={d.pollSeconds} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  {d.lastSeenAt ? (
                    <span title={new Date(d.lastSeenAt).toLocaleString()}>{timeAgo(d.lastSeenAt, now)}</span>
                  ) : (
                    "Never"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <NextPollCountdown lastSeenAt={d.lastSeenAt} pollSeconds={d.pollSeconds} onDue={() => router.refresh()} />
                </td>
                <td className="px-4 py-2.5">
                  {d.lastStatus != null ? <StatusBadge status={d.lastStatus} error={d.lastError} /> : dash}
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center justify-end gap-0.5">
                    {busy === d.id && <Loader2 size={13} className="animate-spin text-muted" />}
                    <DeviceInfoButton d={d} now={now} />
                    <LivePreviewButton deviceId={d.id} deviceName={d.name} />
                    <button
                      type="button"
                      onClick={() => setFilesFor({ name: d.name })}
                      title="ESP32 firmware files for this device (paste the key into config.h)"
                      aria-label={`Setup files for ${d.name}`}
                      className={iconButton}
                    >
                      <FileCode2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRegenerate(d)}
                      disabled={busy !== null}
                      title="Regenerate key"
                      aria-label={`Regenerate key for ${d.name}`}
                      className={iconButton}
                    >
                      <KeyRound size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(d)}
                      disabled={busy !== null}
                      title="Delete device"
                      aria-label={`Delete ${d.name}`}
                      className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-[#ff8a8e] disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted">
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
