"use client";

// Device controls shared by the /devices page and a Service's Devices tab.

import { useState } from "react";
import { Check, Copy, FileCode2, Loader2, X } from "lucide-react";
import { setDevicePollSeconds, setDeviceService, type SubscribableService } from "@/lib/devices/actions";

const selectClass =
  "h-7 max-w-[14rem] cursor-pointer rounded-md border border-[#2e2e2e] bg-[#121212] px-2 text-[13px] text-[#ededed] outline-none hover:border-[#3e3e3e] focus:border-[#3e3e3e] disabled:cursor-default disabled:opacity-60";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
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

// The one-time key, with the config.h lines and a way into the setup files.
export function NewKeyCallout({
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
    <div className="rounded-md border border-[#3ecf8e]/40 bg-[#3ecf8e]/[0.06] p-4 text-[13px]">
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

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state, error }: { state: SaveState; error?: string | null }) {
  if (state === "saving") return <Loader2 size={14} className="shrink-0 animate-spin text-[#a0a0a0]" aria-label="Saving" />;
  if (state === "saved") return <Check size={14} className="shrink-0 text-[#3ecf8e]" aria-label="Saved" />;
  if (state === "error")
    return (
      <span className="text-[12px] text-[#ff8a8e]" title={error ?? undefined}>
        Couldn&apos;t save
      </span>
    );
  return null;
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

export function pollLabel(seconds: number): string {
  return POLL_OPTIONS.find((o) => o.value === seconds)?.label ?? `Every ${seconds} s`;
}

// Per-device dropdown. Saves as soon as it changes; the device picks it up on its next poll.
export function PollFrequency({ deviceId, initial }: { deviceId: string; initial: number }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const options = POLL_OPTIONS.some((o) => o.value === value) ? POLL_OPTIONS : [...POLL_OPTIONS, { value, label: pollLabel(value) }];

  async function change(next: number) {
    const prev = value;
    setValue(next);
    setState("saving");
    try {
      await setDevicePollSeconds(deviceId, next);
      setState("saved");
    } catch {
      setValue(prev);
      setState("error");
    }
  }

  return (
    <label className="flex items-center gap-2" title="How often this device asks for a new screen. Each poll counts towards Vercel's free-tier limit.">
      <span className="sr-only">Poll frequency</span>
      <select value={value} onChange={(e) => void change(Number(e.target.value))} disabled={state === "saving"} className={selectClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <SaveIndicator state={state} />
    </label>
  );
}

// "No service" plus the user's own and shared Services. `extra` keeps a current value that isn't
// in the list (a Service the user can no longer access) selectable.
export function ServiceOptions({
  services,
  extra,
}: {
  services: SubscribableService[];
  extra?: { id: string; label: string } | null;
}) {
  const own = services.filter((s) => !s.shared);
  const shared = services.filter((s) => s.shared);
  return (
    <>
      <option value="">No service</option>
      {extra && (
        <option value={extra.id} disabled>
          {extra.label}
        </option>
      )}
      {own.length > 0 && (
        <optgroup label="My Services">
          {own.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
      {shared.length > 0 && (
        <optgroup label="Shared with me">
          {shared.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}

// Which Service a device shows. Saves as soon as it changes; no reflashing, the device gets the
// new Service's screen on its next poll.
export function ServiceSelect({
  deviceId,
  initial,
  services,
  onChanged,
}: {
  deviceId: string;
  initial: string | null;
  services: SubscribableService[];
  onChanged?: (serviceId: string | null) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const known = !value || services.some((s) => s.id === value);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setState("saving");
    setError(null);
    try {
      await setDeviceService(deviceId, next || null);
      setState("saved");
      onChanged?.(next || null);
    } catch (e) {
      setValue(prev);
      setState("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <label className="flex items-center gap-2" title="The Service this device shows. Changes apply on the device's next poll.">
      <span className="sr-only">Service</span>
      <select value={value} onChange={(e) => void change(e.target.value)} disabled={state === "saving"} className={selectClass}>
        <ServiceOptions services={services} extra={known ? null : { id: value, label: "Service you can't access" }} />
      </select>
      <SaveIndicator state={state} error={error} />
    </label>
  );
}

// Name, plus a Service dropdown when `services` is given (the /devices page). On a Service page the
// Service is fixed, so only the name is asked for.
export function AddDeviceForm({
  services,
  busy,
  onSubmit,
  onCancel,
}: {
  services?: SubscribableService[];
  busy: boolean;
  onSubmit: (name: string, serviceId: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim(), serviceId || null);
      }}
      className="flex flex-wrap items-center gap-2 rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-3 text-[13px]"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Device name, e.g. Kitchen display"
        aria-label="Device name"
        maxLength={100}
        className="min-w-[12rem] flex-1 rounded-md border border-[#2e2e2e] bg-[#161616] px-2.5 py-1.5 text-[#ededed] placeholder:text-[#6b6b6b] focus:border-[#3ecf8e] focus:outline-none"
      />
      {services && (
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          aria-label="Service"
          className="h-[32px] max-w-[16rem] cursor-pointer rounded-md border border-[#2e2e2e] bg-[#161616] px-2 text-[#ededed] outline-none hover:border-[#3e3e3e] focus:border-[#3ecf8e]"
        >
          <ServiceOptions services={services} />
        </select>
      )}
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 py-1.5 font-medium text-[#0f0f0f] hover:bg-[#36b87e] disabled:opacity-50"
      >
        {busy && <Loader2 size={13} className="animate-spin" />}
        Create
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-[#2e2e2e] px-2.5 py-1.5 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]"
      >
        Cancel
      </button>
    </form>
  );
}
