"use client";

import DeviceList from "@/components/device-list/DeviceList";
import { Skeleton, TableRowsSkeleton, skeletonCount } from "@/components/ui/Skeleton";
import { useList, useListCount } from "@/lib/store/cache";

// The /devices page body: stats and the device table, from the client cache (refreshed in the
// background), with the Services the dropdowns offer.
export default function DevicesContent() {
  const devices = useList("devices");
  const services = useList("subscribable");
  const last = useListCount("devices");
  const error = devices.error ?? services.error;

  const errorBox = error && (
    <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
      Could not load devices: {error}
    </p>
  );

  if (!devices.data || !services.data) return errorBox || <DevicesSkeleton rows={skeletonCount(last)} />;

  const online = devices.data.filter((d) => d.online).length;
  return (
    <>
      {errorBox}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Stat label="Total" value={devices.data.length} />
        <Stat label="Online" value={online} dot="bg-accent" />
        <Stat label="Offline" value={devices.data.length - online} dot="bg-muted/50" />
      </div>
      {/* `now` is when the list was loaded, which is what `online` and the countdowns are relative to. */}
      <DeviceList devices={devices.data} services={services.data} now={devices.fetchedAt} />
    </>
  );
}

function DevicesSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Stat label="Total" />
        <Stat label="Online" dot="bg-accent" />
        <Stat label="Offline" dot="bg-muted/50" />
      </div>
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-8 w-64 rounded-md" />
      </div>
      <div className="rounded-md border border-border bg-panel">
        <TableRowsSkeleton rows={rows} cols={6} />
      </div>
    </>
  );
}

function Stat({ label, value, dot }: { label: string; value?: number; dot?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-panel px-3 py-3 sm:px-4">
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
