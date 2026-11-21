"use client";

// Device controls shared by the /devices page and a Service's Devices tab.

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy, FileCode2, FlipVertical2, Loader2, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { setDevicePollSeconds, setDeviceRotation, setDeviceService, type SubscribableService } from "@/lib/devices/actions";
import { FEATURES, missingSentence, type Feature } from "@/lib/draw/capabilities";
import { firmwareForFrame } from "@/lib/firmware/version";

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

// Fixed 14px slot beside a dropdown, so the row doesn't shift as the state changes.
// Live countdown to a device's next poll: last poll + its poll interval. Offline devices (no poll in
// two intervals plus slack) show "Offline". `onDue` fires once a few seconds after a poll was due, so
// the caller can reload and pick up the new last-seen time.
export function NextPollCountdown({
  lastSeenAt,
  pollSeconds,
  onDue,
}: {
  lastSeenAt: string | null;
  pollSeconds: number;
  onDue?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const last = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  const offline = last === null || now - last > (2 * pollSeconds + 15) * 1000;
  const due = last === null ? 0 : last + pollSeconds * 1000;
  const left = Math.ceil((due - now) / 1000);

  useEffect(() => {
    if (offline || left > -3 || !onDue || firedFor.current === due) return;
    firedFor.current = due;
    onDue();
  }, [offline, left, due, onDue]);

  if (last === null) return <span className="text-[#6b6b6b]">Not polled yet</span>;
  if (offline) return <span className="text-[#6b6b6b]">Offline</span>;
  if (left <= 0) return <span className="animate-pulse text-[#3ecf8e]">Due now</span>;
  const m = Math.floor(left / 60);
  return (
    <span className="tabular-nums text-[#ededed]" title={`Last polled ${new Date(last).toLocaleTimeString()}`}>
      {m}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error?: string | null }) {
  return (
    <span className="inline-flex w-3.5 shrink-0 items-center justify-center" role="status" aria-live="polite">
      {state === "saving" && <Loader2 size={14} className="animate-spin text-[#a0a0a0]" aria-label="Saving" />}
      {state === "saved" && <Check size={14} className="text-[#3ecf8e]" aria-label="Saved" />}
      {state === "error" && (
        <span title={error ? `Couldn't save: ${error}` : "Couldn't save"} className="inline-flex">
          <AlertCircle size={14} className="text-[#ff8a8e]" aria-label="Couldn't save" />
        </span>
      )}
    </span>
  );
}

// Seconds between device polls. Each poll is one Vercel function call (Hobby: ~1M/month).
const POLL_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 s" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 1800, label: "30 min" },
  { value: 3600, label: "1 hour" },
];

export function pollLabel(seconds: number): string {
  return POLL_OPTIONS.find((o) => o.value === seconds)?.label ?? `${seconds} s`;
}

// Per-device dropdown. Saves as soon as it changes; the device picks it up on its next poll.
export function PollFrequency({
  deviceId,
  initial,
  onChanged,
}: {
  deviceId: string;
  initial: number;
  onChanged?: (seconds: number) => void;
}) {
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
      onChanged?.(next);
    } catch {
      setValue(prev);
      setState("error");
    }
  }

  return (
    <label className="flex items-center gap-1.5" title="How often this device asks for a new screen. Each poll counts towards Vercel's free-tier limit.">
      <span className="sr-only">Update frequency</span>
      <Select
        value={value}
        onChange={(e) => void change(Number(e.target.value))}
        disabled={state === "saving"}
        className="w-28 shrink-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
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
    <label className="flex items-center gap-1.5" title="The Service this device shows. Changes apply on the device's next poll.">
      <span className="sr-only">Service</span>
      <Select
        value={value}
        onChange={(e) => void change(e.target.value)}
        disabled={state === "saving"}
        className="w-[13.5rem] shrink-0"
      >
        <ServiceOptions services={services} extra={known ? null : { id: value, label: "Service you can't access" }} />
      </Select>
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
        className="h-8 min-w-[12rem] flex-1 rounded-md border border-[#2e2e2e] bg-[#161616] px-2.5 text-[#ededed] placeholder:text-[#6b6b6b] focus:border-[#3ecf8e] focus:outline-none"
      />
      {services && (
        <Select
          size="md"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          aria-label="Service"
          className="w-[14rem] shrink-0"
        >
          <ServiceOptions services={services} />
        </Select>
      )}
      <button
        type="submit"
        disabled={!name.trim() || busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-2.5 font-medium text-[#0f0f0f] hover:bg-[#36b87e] disabled:opacity-50"
      >
        {busy && <Loader2 size={13} className="animate-spin" />}
        Create
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md border border-[#2e2e2e] px-2.5 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]"
      >
        Cancel
      </button>
    </form>
  );
}

// Flips the device's screen 180° (for a display mounted upside down) or back. The state shows in
// the icon (turned and green when flipped). Firmware older than 2.0 ignores the setting: it's
// saved anyway and applies once the device is reflashed, and the tooltip says so.
export function ScreenFlipButton({
  deviceId,
  deviceName,
  rotation,
  frameVersion,
  onChanged,
  className,
  label = false,
}: {
  deviceId: string;
  deviceName: string;
  rotation: 1 | 3;
  /** The frame schema the device's firmware reads (deviceFrameVersion); null if it never polled. */
  frameVersion: number | null;
  onChanged?: (rotation: 1 | 3) => void;
  className?: string;
  /** Show "Flip"/"Flipped" next to the icon. */
  label?: boolean;
}) {
  const [value, setValue] = useState(rotation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null); // callers key it by `rotation` to resync

  const flipped = value === 3;
  const need = FEATURES.screenFlip.minFrame;
  const unsupported = frameVersion !== null && frameVersion < need;
  const title = [
    flipped ? "Screen orientation: flipped 180° — click to set back to normal" : "Screen orientation: normal — click to flip 180°",
    unsupported
      ? `This device runs older firmware: the setting is saved, but only applies after you reflash it with ${firmwareForFrame(need)}.`
      : frameVersion === null
        ? `Needs ${firmwareForFrame(need)} or later on the device.`
        : "",
    error ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  async function toggle() {
    const next: 1 | 3 = flipped ? 1 : 3;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      await setDeviceRotation(deviceId, next);
      onChanged?.(next);
    } catch (e) {
      setValue(value);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={saving}
      title={title}
      aria-label={`${flipped ? "Unflip" : "Flip"} the screen of ${deviceName}`}
      aria-pressed={flipped}
      className={`${className ?? ""} inline-flex items-center gap-1 whitespace-nowrap ${
        error ? "text-[#ff8a8e]" : flipped ? (unsupported ? "text-amber-300" : "text-[#3ecf8e]") : ""
      }`}
    >
      {saving ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <FlipVertical2 size={13} className={flipped ? "rotate-180 transition-transform" : "transition-transform"} />
      )}
      {label && (flipped ? "Flipped" : "Flip")}
    </button>
  );
}

// Amber "Update firmware" pill for a device whose screen uses something its firmware can't draw
// (rotated text, the screen flip). Nothing for devices that need nothing new, however old.
export function FirmwareUpdateBadge({ fw, missing, onClick }: { fw: string | null; missing: Feature[]; onClick?: () => void }) {
  if (!missing.length) return null;
  const title = `Running ${fw ?? "older firmware"}. ${missingSentence(missing)} Click for the setup files, then upload them again.`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-400/20"
    >
      <AlertCircle size={11} aria-hidden /> Update firmware
    </button>
  );
}
