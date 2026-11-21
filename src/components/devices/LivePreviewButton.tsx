"use client";

// "Live" button for a device row: a popup showing roughly what the device's screen shows right now.
// Nothing stores the frame a device was sent, so the screen is rebuilt here the same way the poll
// endpoint (src/app/api/device/frame/route.ts) builds it: the Service's saved Draw ops filled with
// the saved Data code's current variables (POST /api/preview with no `code`). Close enough, not exact.
// Like the endpoint, a device on 1.x firmware is shown its v1 frame (rotated text unrotated, 180°
// rotation ignored); a rotated device on 2.0+ is shown turned 180°, as someone facing it sees it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MonitorPlay } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import DevicePreview from "@/components/draw/DevicePreview";
import { createClient } from "@/lib/supabase/client";
import { toWireOps, type DrawRow, type WireOp } from "@/lib/draw/ops";
import { toV1Ops } from "@/lib/draw/rotate";
import { FEATURES } from "@/lib/draw/capabilities";
import { deviceFrameVersion, firmwareForFrame } from "@/lib/firmware/version";
import { errorFrameOps, noServiceOps } from "@/lib/draw/screens";

// Keep in sync with the device endpoint.
const DEFAULT_POLL_S = 30;
const DISABLED_POLL_S = 300;
const DEVICE_REFRESH_MS = 5_000;
const SCREEN_REFRESH_MS = 30_000;

interface DeviceRow {
  id: string;
  name: string;
  service_id: string | null;
  last_seen_at: string | null;
  poll_seconds?: number | null;
  rotation?: number | null; // added by migration 011
}

type Screen =
  | { kind: "none" } // no Service, or one the device's owner can no longer access
  | { kind: "off"; name: string }
  | { kind: "ok"; name: string; ops: WireOp[] }
  | { kind: "dataError"; name: string; ops: WireOp[]; error: string }
  | { kind: "error"; error: string };

function ago(seconds: number): string {
  if (seconds < 60) return `${seconds} s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function LivePreview({ deviceId, deviceName, frameVersion }: { deviceId: string; deviceName: string; frameVersion: number | null }) {
  const [device, setDevice] = useState<DeviceRow | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const serviceIdRef = useRef<string | null | undefined>(undefined);
  const screenRequest = useRef(0);

  const loadScreen = useCallback(
    async (serviceId: string | null) => {
      const id = ++screenRequest.current;
      const done = (s: Screen) => id === screenRequest.current && setScreen(s);
      if (!serviceId) return done({ kind: "none" });
      try {
        const { data, error } = await createClient()
          .from("services")
          .select("id, name, enabled, draw_ops")
          .eq("id", serviceId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        // Not readable = the device's owner lost access, so the endpoint sends "No service assigned".
        if (!data) return done({ kind: "none" });
        const service = data as { name: string; enabled: boolean; draw_ops: DrawRow[] | null };
        if (!service.enabled) return done({ kind: "off", name: service.name });

        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId }), // no `code`: runs the saved Data code, like the device
        });
        const body = (await res.json().catch(() => ({}))) as { vars?: Record<string, unknown>; error?: string };
        if (!res.ok || !body.vars) throw new Error(body.error ?? `Preview failed (HTTP ${res.status})`);
        if (body.error) {
          return done({ kind: "dataError", name: service.name, ops: errorFrameOps(body.error), error: body.error });
        }
        const rows = Array.isArray(service.draw_ops) ? service.draw_ops : [];
        done({ kind: "ok", name: service.name, ops: toWireOps(rows, body.vars) });
      } catch (e) {
        done({ kind: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },
    [],
  );

  const loadDevice = useCallback(async () => {
    const { data, error } = await createClient().from("devices").select("*").eq("id", deviceId).maybeSingle();
    if (error) return setDeviceError(error.message);
    if (!data) return setDeviceError("Device not found");
    const row = data as DeviceRow;
    setDeviceError(null);
    setDevice(row);
    // Rebuild the screen straight away when the device moves to another Service.
    if (serviceIdRef.current !== row.service_id) {
      serviceIdRef.current = row.service_id;
      void loadScreen(row.service_id);
    }
  }, [deviceId, loadScreen]);

  // Device info every 5 s, the screen every 30 s, the clock every second. All stop on unmount (close).
  useEffect(() => {
    const first = setTimeout(loadDevice, 0);
    const deviceTimer = setInterval(loadDevice, DEVICE_REFRESH_MS);
    const screenTimer = setInterval(() => {
      if (serviceIdRef.current !== undefined) void loadScreen(serviceIdRef.current);
    }, SCREEN_REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(deviceTimer);
      clearInterval(screenTimer);
      clearInterval(tick);
    };
  }, [loadDevice, loadScreen]);

  const disabled = screen?.kind === "off";
  const interval = disabled ? DISABLED_POLL_S : (device?.poll_seconds ?? DEFAULT_POLL_S);
  const seenMs = device?.last_seen_at ? new Date(device.last_seen_at).getTime() : null;
  const sinceS = seenMs === null ? null : Math.max(0, Math.floor((now - seenMs) / 1000));
  const remainingS = sinceS === null ? null : interval - sinceS;
  const offline = sinceS === null || sinceS > 2 * interval + 15;

  // When the countdown reaches 0, refresh both right away (once per poll).
  const dueFor = useRef<string | null>(null);
  useEffect(() => {
    if (remainingS === null || remainingS > 0 || offline || !device?.last_seen_at) return;
    if (dueFor.current === device.last_seen_at) return;
    dueFor.current = device.last_seen_at;
    void loadDevice();
    void loadScreen(device.service_id);
  }, [remainingS, offline, device, loadDevice, loadScreen]);

  const v1 = frameVersion !== null && frameVersion < 2;
  const rotatedSet = device?.rotation === 3;
  const rotatedShown = rotatedSet && frameVersion !== null && frameVersion >= FEATURES.screenRotation.minFrame;

  if (deviceError) {
    return <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">{deviceError}</p>;
  }
  if (!device) {
    return (
      <p className="py-10 text-center text-[#a0a0a0]">
        <Loader2 size={14} className="inline animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#a0a0a0]">
        <span className="inline-flex items-center gap-2 text-[#ededed]">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${offline ? "bg-[#4a4a4a]" : "bg-[#3ecf8e] shadow-[0_0_6px_#3ecf8e]"}`}
          />
          {offline ? "Offline" : "Online"}
        </span>
        <span title={seenMs ? new Date(seenMs).toLocaleString() : undefined}>
          Last polled {sinceS === null ? "never" : ago(sinceS)}
        </span>
        <span className="tabular-nums">
          {sinceS === null
            ? null
            : offline
              ? "Device offline"
              : remainingS! > 0
                ? `Next update in ${mmss(remainingS!)}`
                : "Update due…"}
        </span>
      </div>

      {sinceS === null ? (
        <p className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-6 text-center text-[#a0a0a0]">
          This device hasn&apos;t fetched a screen yet.
        </p>
      ) : !screen ? (
        <p className="py-10 text-center text-[#a0a0a0]">
          <Loader2 size={14} className="inline animate-spin" /> Building the screen…
        </p>
      ) : screen.kind === "error" ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">{screen.error}</p>
      ) : screen.kind === "off" ? (
        <p className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c] px-3 py-6 text-center text-[#a0a0a0]">
          <span className="text-[#ededed]">{screen.name}</span> is turned off; the device keeps its last screen.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <DevicePreview
            ops={screen.kind === "none" ? noServiceOps(deviceName) : v1 ? toV1Ops(screen.ops) : screen.ops}
            scale={2}
            rotated180={rotatedShown}
          />
          <p className="text-center text-[12px] text-[#6b6b6b]">
            {screen.kind === "none" ? (
              "No service assigned: this is the screen the device is sent."
            ) : (
              <>
                What this device shows: <span className="text-[#a0a0a0]">{screen.name}</span>, built from the saved
                Service with current data, so it may differ slightly from the device.
                {screen.kind === "dataError" && <span className="block text-red-300">Data error: {screen.error}</span>}
              </>
            )}
            {rotatedShown && <span className="block">Shown turned 180°, the way this device shows it.</span>}
            {rotatedSet && !rotatedShown && (
              <span className="block">
                Rotate 180° is set, but {frameVersion === null ? "the device hasn't reported its firmware yet" : "this device's firmware ignores it"}; it
                applies with {firmwareForFrame(FEATURES.screenRotation.minFrame)} or later.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default function LivePreviewButton({
  deviceId,
  deviceName,
  fw = null,
  polled = false,
}: {
  deviceId: string;
  deviceName: string;
  /** X-FW from the device's latest poll, to show what its firmware draws. */
  fw?: string | null;
  polled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What this device's screen shows now"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#ededed]"
      >
        <MonitorPlay size={13} /> Live
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Live preview: ${deviceName}`} className="max-w-[720px]">
        {/* Mounted only while open, so its timers stop when the dialog closes. */}
        {open && <LivePreview deviceId={deviceId} deviceName={deviceName} frameVersion={deviceFrameVersion(fw, polled)} />}
      </Dialog>
    </>
  );
}
