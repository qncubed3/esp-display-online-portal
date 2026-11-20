"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, FileCode2, KeyRound, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  addDevice,
  deleteDevice,
  listDevices,
  regenerateDeviceKey,
  type DeviceRow,
} from "@/lib/devices/actions";
import { updateService } from "@/app/services/[id]/actions";
import SetupFilesDialog from "./SetupFilesDialog";

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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#232323] px-2 py-1 text-[12px] text-[#ededed] hover:bg-[#2a2a2a]"
    >
      {copied ? <Check size={13} className="text-[#3ecf8e]" /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function NewKeyCallout({
  deviceName,
  keyValue,
  onClose,
  onSetupFiles,
}: {
  deviceName: string;
  keyValue: string;
  onClose: () => void;
  onSetupFiles: () => void;
}) {
  // Only rendered after a client-side action, so window is always available here.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const snippet = `#define SERVICE_URL "${origin}/api/device/frame"\n#define DEVICE_KEY  "${keyValue}"`;

  return (
    <div className="rounded-md border border-[#3ecf8e]/40 bg-[#3ecf8e]/[0.06] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[#ededed]">Key for &ldquo;{deviceName}&rdquo;</p>
          <p className="mt-0.5 text-[#a0a0a0]">Copy it now. It is shown only once and can&apos;t be retrieved later.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-md p-1 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]">
          <X size={15} />
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-[#2e2e2e] bg-[#161616] px-2.5 py-1.5 font-mono text-[12px] text-[#ededed]">
          {keyValue}
        </code>
        <CopyButton text={keyValue} label="Copy key" />
      </div>

      <div className="relative">
        <pre className="overflow-x-auto rounded-md border border-[#2e2e2e] bg-[#161616] p-3 pr-24 font-mono text-[12px] leading-relaxed text-[#ededed]">
          {snippet}
        </pre>
        <div className="absolute right-2 top-2">
          <CopyButton text={snippet} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[#a0a0a0]">Or get the complete ESP32 firmware with this key filled in.</p>
        <button
          type="button"
          onClick={onSetupFiles}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#3ecf8e]/50 bg-[#3ecf8e]/10 px-2.5 py-1.5 font-medium text-[#3ecf8e] hover:bg-[#3ecf8e]/20"
        >
          <FileCode2 size={14} /> Setup files
        </button>
      </div>
    </div>
  );
}

// Seconds between device polls. Each poll is one Vercel function call (Hobby: ~1M/month).
const POLL_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "Every 15 s" },
  { value: 30, label: "Every 30 s" },
  { value: 60, label: "Every minute" },
  { value: 120, label: "Every 2 min" },
  { value: 300, label: "Every 5 min" },
  { value: 600, label: "Every 10 min" },
  { value: 1800, label: "Every 30 min" },
  { value: 3600, label: "Every hour" },
];

// Saves as soon as it changes; devices pick the new value up on their next poll.
function PollFrequency({ serviceId, initial }: { serviceId: string; initial: number }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const options = POLL_OPTIONS.some((o) => o.value === value) ? POLL_OPTIONS : [...POLL_OPTIONS, { value, label: `Every ${value} s` }];

  async function change(next: number) {
    const prev = value;
    setValue(next);
    setState("saving");
    try {
      await updateService(serviceId, { pollSeconds: next });
      setState("saved");
    } catch {
      setValue(prev);
      setState("error");
    }
  }

  return (
    <label className="flex items-center gap-2 text-[#a0a0a0]" title="How often devices ask for a new screen. Each poll counts towards Vercel's free-tier limit.">
      <span>Poll</span>
      <select
        value={value}
        onChange={(e) => void change(Number(e.target.value))}
        disabled={state === "saving"}
        className="h-7 cursor-pointer rounded-md border border-[#2e2e2e] bg-[#121212] px-2 text-[13px] text-[#ededed] outline-none focus:border-[#3e3e3e]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {state === "saving" && <Loader2 size={14} className="animate-spin" aria-label="Saving" />}
      {state === "saved" && <Check size={14} className="text-[#3ecf8e]" aria-label="Saved" />}
      {state === "error" && <span className="text-[12px] text-[#ff8a8e]">Couldn&apos;t save</span>}
    </label>
  );
}

export default function DevicesPanel({ serviceId, pollSeconds = 30 }: { serviceId: string; pollSeconds?: number }) {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // device id, or "add"
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [shownKey, setShownKey] = useState<{ name: string; key: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Setup files dialog: key is set when opened from the one-time key callout.
  const [filesFor, setFilesFor] = useState<{ name: string; key?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setDevices(await listDevices(serviceId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [serviceId]);

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

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await run("add", () => addDevice(serviceId, name));
    if (res) {
      setShownKey({ name, key: res.key });
      setAdding(false);
      setNewName("");
      await load();
    }
  }

  async function onRegenerate(d: DeviceRow) {
    if (!confirm(`Regenerate the key for "${d.name}"? The current key stops working immediately.`)) return;
    const key = await run(d.id, () => regenerateDeviceKey(d.id));
    if (key) setShownKey({ name: d.name, key });
  }

  async function onDelete(d: DeviceRow) {
    if (!confirm(`Delete device "${d.name}"? It will no longer be able to fetch frames.`)) return;
    await run(d.id, () => deleteDevice(d.id));
    await load();
  }

  return (
    <section className="space-y-3 text-[13px] text-[#ededed]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-medium">Devices</h2>
          <p className="text-[#a0a0a0]">ESP32 screens that show this service.</p>
        </div>
        <div className="flex items-center gap-3">
        <PollFrequency serviceId={serviceId} initial={pollSeconds} />
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#3ecf8e]/50 bg-[#3ecf8e]/10 px-2.5 py-1.5 font-medium text-[#3ecf8e] hover:bg-[#3ecf8e]/20"
          >
            <Plus size={14} /> Add device
          </button>
        )}
        </div>
      </div>

      {adding && (
        <form onSubmit={onAdd} className="flex items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Device name, e.g. Kitchen display"
            maxLength={100}
            className="min-w-0 flex-1 rounded-md border border-[#2e2e2e] bg-[#161616] px-2.5 py-1.5 text-[#ededed] placeholder:text-[#6b6b6b] focus:border-[#3ecf8e] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim() || busy === "add"}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 py-1.5 font-medium text-[#0f0f0f] hover:bg-[#36b87e] disabled:opacity-50"
          >
            {busy === "add" && <Loader2 size={13} className="animate-spin" />}
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
            className="rounded-md border border-[#2e2e2e] px-2.5 py-1.5 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]"
          >
            Cancel
          </button>
        </form>
      )}

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

      {error && <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">{error}</p>}

      <div className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#1c1c1c]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#2e2e2e] text-[12px] text-[#a0a0a0]">
              <th className="px-3 py-2 font-normal">Name</th>
              <th className="px-3 py-2 font-normal">Last seen</th>
              <th className="w-px px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {devices === null && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[#a0a0a0]">
                  <Loader2 size={14} className="inline animate-spin" /> Loading…
                </td>
              </tr>
            )}
            {devices?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[#a0a0a0]">
                  No devices yet. Add one to get a key for your ESP32.
                </td>
              </tr>
            )}
            {devices?.map((d) => {
              const online = !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < ONLINE_MS;
              return (
                <tr key={d.id} className="border-b border-[#2e2e2e] last:border-b-0 hover:bg-[#232323]">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${online ? "bg-[#3ecf8e] shadow-[0_0_6px_#3ecf8e]" : "bg-[#4a4a4a]"}`}
                        title={online ? "Online" : "Offline"}
                      />
                      {d.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#a0a0a0]" title={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : undefined}>
                    {relativeTime(d.last_seen_at, now)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {busy === d.id && <Loader2 size={13} className="animate-spin text-[#a0a0a0]" />}
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
