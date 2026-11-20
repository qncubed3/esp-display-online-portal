import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import DeviceList from "@/components/device-list/DeviceList";
import { Skeleton, TableRowsSkeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import { listSubscribableServices, type SubscribableService } from "@/lib/devices/actions";
import { loadDeviceList } from "@/lib/device-list/load";
import type { DeviceListRow } from "@/lib/device-list/types";

export default function DevicesPage() {
  return (
    <AppShell crumbs={[{ label: "Devices" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-xl font-medium">Devices</h1>
        <Suspense fallback={<DevicesSkeleton />}>
          <DevicesContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

function DevicesSkeleton() {
  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Total" />
        <Stat label="Online" dot="bg-accent" />
        <Stat label="Offline" dot="bg-muted/50" />
      </div>
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-8 w-64 rounded-md" />
      </div>
      <div className="rounded-md border border-border bg-panel">
        <TableRowsSkeleton rows={4} cols={6} />
      </div>
    </>
  );
}

async function DevicesContent() {
  const { supabase, user } = await requireUser();
  let devices: DeviceListRow[] = [];
  let services: SubscribableService[] = [];
  let error: string | null = null;
  try {
    [devices, services] = await Promise.all([loadDeviceList(supabase, user.id), listSubscribableServices()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const online = devices.filter((d) => d.online).length;

  return (
    <>
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
            <DeviceList devices={devices} services={services} now={Date.now()} />
          </>
        )}
    </>
  );
}

function Stat({ label, value, dot }: { label: string; value?: number; dot?: string }) {
  return (
    <div className="rounded-md border border-border bg-panel px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </div>
      {value === undefined ? (
        <Skeleton className="my-2.5 h-4 w-10" />
      ) : (
        <div className="text-2xl font-medium tabular-nums">{value}</div>
      )}
    </div>
  );
}
