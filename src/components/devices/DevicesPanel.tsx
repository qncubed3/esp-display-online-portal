"use client";

// A Service's Devices tab: the devices subscribed to this Service. Devices belong to users, so the
// signed-in user's own devices get full controls and other people's are read-only.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FileCode2, KeyRound, Loader2, Plus, Trash2, Users } from "lucide-react";
import {
  addDevice,
  deleteDevice,
  listMyDevices,
  listServiceDevices,
  listSubscribableServices,
  regenerateDeviceKey,
  renameDevice,
  setDeviceService,
  type MyDeviceRow,
  type ServiceDeviceRow,
  type SubscribableService,
} from "@/lib/devices/actions";
import { InlineRename } from "@/components/ui/InlineRename";
import { Select } from "@/components/ui/Select";
import LivePreviewButton from "./LivePreviewButton";
import SetupFilesDialog from "./SetupFilesDialog";
import { devicesChanged, refreshLists } from "@/lib/store/cache";
import {
  AddDeviceForm,
  FirmwareUpdateBadge,
  NewKeyCallout,
  NextPollCountdown,
  PollFrequency,
  ScreenFlipButton,
  ServiceSelect,
  pollLabel,
} from "./DeviceControls";
import { deviceMissingFeatures } from "@/lib/draw/capabilities";
import { deviceFrameVersion } from "@/lib/firmware/version";

const ONLINE_MS = 2 * 60 * 1000;

function relativeTime(iso: string | null, now: number): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// "Subscribe a device": one of the user's devices that's elsewhere (or nowhere), moved here.
function SubscribeDevice({
  devices,
  busy,
  onMove,
}: {
  devices: MyDeviceRow[];
  busy: boolean;
  onMove: (device: MyDeviceRow) => void;
}) {
  const [selected, setSelected] = useState("");
  const device = devices.find((d) => d.id === selected) ?? null;
  if (devices.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-2.5">
      <span className="text-[#a0a0a0]">Subscribe a device</span>
      <Select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Device to move to this Service"
        className="w-[20rem] max-w-full"
      >
        <option value="">Choose one of your devices…</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} {d.service_id ? `(on ${d.service_name ?? "another Service"})` : "(no service)"}
          </option>
        ))}
      </Select>
      <button
        type="button"
        disabled={!device || busy}
        onClick={() => {
          if (device) {
            onMove(device);
            setSelected("");
          }
        }}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#232323] px-2.5 text-[#ededed] hover:bg-[#2a2a2a] disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Move here
      </button>
      <span className="text-[12px] text-[#6b6b6b]">Same key, no reflashing: it shows this Service on its next poll.</span>
    </div>
  );
}

export default function DevicesPanel({ serviceId }: { serviceId: string }) {
  const [devices, setDevices] = useState<ServiceDeviceRow[] | null>(null);
  const [mine, setMine] = useState<MyDeviceRow[]>([]);
  const [services, setServices] = useState<SubscribableService[]>([]);
  const [error, setError] = useState<string | null>(null); // from the last action
  const [loadError, setLoadError] = useState<string | null>(null); // from the last (re)load
  const [busy, setBusy] = useState<string | null>(null); // device id, "add" or "move"
  const [adding, setAdding] = useState(false);
  const [shownKey, setShownKey] = useState<{ name: string; key: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Setup files dialog: key is set when opened from the one-time key callout.
  const [filesFor, setFilesFor] = useState<{ name: string; key?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [onService, own, subscribable] = await Promise.all([
        listServiceDevices(serviceId),
        listMyDevices(),
        listSubscribableServices(),
      ]);
      setDevices(onService);
      setMine(own);
      setServices(subscribable);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [serviceId]);

  // After a change here: reload this panel, and refresh the cached lists on /devices and the Service tabs.
  const changed = useCallback(async () => {
    devicesChanged();
    await load();
  }, [load]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

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

  async function onAdd(name: string) {
    const res = await run("add", () => addDevice(name, serviceId));
    if (res) {
      setShownKey({ name, key: res.key });
      setAdding(false);
      await changed();
    }
  }

  async function onMove(d: MyDeviceRow) {
    await run("move", () => setDeviceService(d.id, serviceId));
    await changed();
  }

  async function onRegenerate(d: ServiceDeviceRow) {
    if (!confirm(`Regenerate the key for "${d.name}"? The current key stops working immediately.`)) return;
    const key = await run(d.id, () => regenerateDeviceKey(d.id));
    if (key) setShownKey({ name: d.name, key });
  }

  async function onDelete(d: ServiceDeviceRow) {
    if (!confirm(`Delete device "${d.name}"? It will no longer be able to fetch frames.`)) return;
    await run(d.id, () => deleteDevice(d.id));
    await changed();
  }

  const movable = mine.filter((d) => d.service_id !== serviceId);

  return (
    <section className="min-w-0 space-y-3 text-[13px] text-[#ededed]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium">Devices</h2>
          <p className="text-[#a0a0a0]">
            ESP32 screens subscribed to this service.{" "}
            <Link href="/devices" className="text-[#3ecf8e] hover:underline">
              Manage all devices →
            </Link>
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#3ecf8e]/50 bg-[#3ecf8e]/10 px-2.5 py-1.5 font-medium text-[#3ecf8e] hover:bg-[#3ecf8e]/20"
          >
            <Plus size={14} /> Add device
          </button>
        )}
      </div>

      {adding && <AddDeviceForm busy={busy === "add"} onSubmit={(name) => void onAdd(name)} onCancel={() => setAdding(false)} />}

      {shownKey && (
        <NewKeyCallout
          deviceName={shownKey.name}
          keyValue={shownKey.key}
          onClose={() => setShownKey(null)}
          onSetupFiles={() => setFilesFor({ name: shownKey.name, key: shownKey.key })}
        />
      )}

      {filesFor && (
        <SetupFilesDialog deviceName={filesFor.name} deviceKey={filesFor.key} onClose={() => setFilesFor(null)} />
      )}

      {(error ?? loadError) && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">{error ?? loadError}</p>
      )}

      <SubscribeDevice devices={movable} busy={busy === "move"} onMove={(d) => void onMove(d)} />

      <div className="overflow-x-auto rounded-md border border-[#2e2e2e] bg-[#1c1c1c]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="whitespace-nowrap border-b border-[#2e2e2e] text-[12px] text-[#a0a0a0]">
              <th className="px-3 py-2 font-normal">Name</th>
              <th className="px-3 py-2 font-normal">Last seen</th>
              <th className="px-3 py-2 font-normal">Next update</th>
              <th className="px-3 py-2 font-normal">Service</th>
              <th className="px-3 py-2 font-normal">Update frequency</th>
              <th className="w-px px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {devices === null && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#a0a0a0]">
                  <Loader2 size={14} className="inline animate-spin" /> Loading…
                </td>
              </tr>
            )}
            {devices?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[#a0a0a0]">
                  No devices on this service yet. Add one, or move one of your devices here.
                </td>
              </tr>
            )}
            {devices?.map((d) => {
              const online = !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_MS;
              return (
                <tr key={d.id} className="border-b border-[#2e2e2e] last:border-b-0 hover:bg-[#232323]">
                  <td className="px-3 py-2">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-[#3ecf8e] shadow-[0_0_6px_#3ecf8e]" : "bg-[#4a4a4a]"}`}
                        title={online ? "Online" : "Offline"}
                      />
                      {d.mine ? (
                        <InlineRename
                          value={d.name}
                          label={`Rename ${d.name}`}
                          onSave={async (name) => {
                            await renameDevice(d.id, name);
                            await changed();
                          }}
                        />
                      ) : (
                        d.name
                      )}
                      {d.mine && (
                        <FirmwareUpdateBadge
                          fw={d.fw}
                          missing={deviceMissingFeatures({ rotation: d.rotation, contentNeeds: d.content_needs, fw: d.fw, polled: d.polled })}
                          onClick={() => setFilesFor({ name: d.name })}
                        />
                      )}
                      {!d.mine && (
                        <span
                          className="inline-flex min-w-0 items-center gap-1 text-[12px] text-[#6b6b6b]"
                          title={`Owned by ${d.owner_email ?? "another user"}; only its owner can change it`}
                        >
                          <Users size={12} className="shrink-0" />
                          <span className="truncate">{d.owner_email ?? "owned by someone else"}</span>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#a0a0a0]" title={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : undefined}>
                    {relativeTime(d.last_seen_at, now)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <NextPollCountdown lastSeenAt={d.last_seen_at} pollSeconds={d.poll_seconds ?? 30} onDue={() => void load()} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {d.mine ? (
                      <ServiceSelect
                        key={d.service_id ?? ""}
                        deviceId={d.id}
                        initial={d.service_id}
                        services={services}
                        onChanged={() => void changed()}
                      />
                    ) : (
                      <span className="text-[#a0a0a0]">This service</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {d.mine ? (
                      <PollFrequency deviceId={d.id} initial={d.poll_seconds ?? 30} onChanged={() => refreshLists("devices")} />
                    ) : (
                      <span className="text-[#a0a0a0]">{pollLabel(d.poll_seconds ?? 30)}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {d.mine && (
                      <div className="flex items-center justify-end gap-1">
                        {busy === d.id && <Loader2 size={13} className="animate-spin text-[#a0a0a0]" />}
                        <ScreenFlipButton
                          key={d.rotation ?? 1}
                          deviceId={d.id}
                          deviceName={d.name}
                          rotation={d.rotation === 3 ? 3 : 1}
                          frameVersion={deviceFrameVersion(d.fw, d.polled)}
                          onChanged={() => void changed()}
                          label
                          className="rounded-md px-2 py-1 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed] disabled:opacity-50"
                        />
                        <LivePreviewButton deviceId={d.id} deviceName={d.name} fw={d.fw} polled={d.polled} />
                        <button
                          type="button"
                          onClick={() => setFilesFor({ name: d.name })}
                          title="ESP32 firmware files for this device"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]"
                        >
                          <FileCode2 size={13} /> Setup files
                        </button>
                        <button
                          type="button"
                          onClick={() => onRegenerate(d)}
                          disabled={busy !== null}
                          title="Regenerate key"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed] disabled:opacity-50"
                        >
                          <KeyRound size={13} /> Regenerate key
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(d)}
                          disabled={busy !== null}
                          title="Delete device"
                          aria-label={`Delete ${d.name}`}
                          className="rounded-md p-1.5 text-[#a0a0a0] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
