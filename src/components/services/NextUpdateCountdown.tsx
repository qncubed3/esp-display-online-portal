"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface DevicePoll {
  name: string;
  lastSeen: number; // ms
  interval: number; // s
}

const REFRESH_MS = 10_000;
const DEFAULT_INTERVAL_S = 30;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// "Next device update in 0:23": when the soonest-polling device on this Service will next fetch the
// screen, from its last poll time + its poll interval. That's when a deploy shows up on the device.
export default function NextUpdateCountdown({ serviceId }: { serviceId: string }) {
  const [devices, setDevices] = useState<DevicePoll[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    async function load() {
      const { data } = await supabase.from("devices").select("*").eq("service_id", serviceId);
      if (!alive || !data) return;
      setDevices(
        data
          .filter((d) => d.last_seen_at)
          .map((d) => ({
            name: d.name as string,
            lastSeen: new Date(d.last_seen_at as string).getTime(),
            interval: (d.poll_seconds as number | null) ?? DEFAULT_INTERVAL_S,
          })),
      );
    }
    void load();
    const refresh = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [serviceId]);

  if (!devices) return null;

  // Online = polled within two intervals (plus slack for a slow request).
  const online = devices.filter((d) => now - d.lastSeen < (2 * d.interval + 15) * 1000);
  if (online.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <Timer size={14} /> {devices.length ? "No devices online" : "No devices have polled yet"}
      </span>
    );
  }

  const next = online
    .map((d) => ({ ...d, at: d.lastSeen + d.interval * 1000 }))
    .sort((a, b) => a.at - b.at)[0];
  const left = Math.ceil((next.at - now) / 1000);
  const title = online
    .map((d) => `${d.name}: every ${d.interval}s, last polled ${Math.round((now - d.lastSeen) / 1000)}s ago`)
    .join("\n");

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted tabular-nums" title={title}>
      <Timer size={14} className={left <= 0 ? "animate-pulse text-accent" : undefined} />
      {left > 0 ? (
        <>
          Next device update in <span className="font-medium text-fg">{fmt(left)}</span>
        </>
      ) : (
        <span>Device update due now…</span>
      )}
      {online.length > 1 && <span className="text-[12px]">(soonest of {online.length})</span>}
    </span>
  );
}
