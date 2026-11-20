import AppShell from "@/components/layout/AppShell";
import DeviceList from "@/components/device-list/DeviceList";
import { requireUser } from "@/lib/auth";
import { loadDeviceList } from "@/lib/device-list/load";
import type { DeviceListRow } from "@/lib/device-list/types";

export default async function DevicesPage() {
  const { supabase, user } = await requireUser();
  let devices: DeviceListRow[] = [];
  let error: string | null = null;
  try {
    devices = await loadDeviceList(supabase, user.id);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const online = devices.filter((d) => d.online).length;

  return (
    <AppShell email={user.email ?? ""} crumbs={[{ label: "Devices" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-xl font-medium">Devices</h1>

        {error && (
          <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
            Could not load devices: {error}
          </p>
        )}

        {!error && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-4">
              <Stat label="Total" value={devices.length} />
              <Stat label="Online" value={online} dot="bg-accent" />
              <Stat label="Offline" value={devices.length - online} dot="bg-muted/50" />
            </div>
            <DeviceList devices={devices} now={Date.now()} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="rounded-md border border-border bg-panel px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </div>
      <div className="text-2xl font-medium tabular-nums">{value}</div>
    </div>
  );
}
