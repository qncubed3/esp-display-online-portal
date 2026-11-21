"use client";

import Link from "next/link";
import { Cpu, Monitor } from "lucide-react";
import ServiceLink from "@/components/services/ServiceLink";
import ServiceThumb from "@/components/services/ServiceThumb";
import { Badge } from "@/components/ui/Badge";
import { CardGridSkeleton, skeletonCount } from "@/components/ui/Skeleton";
import { useList, useListCount } from "@/lib/store/cache";
import { timeAgo } from "@/lib/time";

// "N shared with you →" next to the My Services heading; nothing until the shared list has loaded.
export function SharedLink() {
  const count = useList("shared").data?.length;
  if (!count) return null;
  return (
    <Link href="/shared" className="text-[13px] text-muted transition-colors hover:text-fg">
      {count} shared with you →
    </Link>
  );
}

// The user's own Services as cards, from the client cache (refreshed in the background).
export default function ServiceGrid() {
  const { data: services, error } = useList("services");
  const last = useListCount("services");

  const errorBox = error && (
    <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
      Could not load services: {error}
    </p>
  );

  if (!services) return errorBox || <CardGridSkeleton preview count={skeletonCount(last)} />;

  if (services.length === 0) {
    return (
      <>
        {errorBox}
        <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-4 py-16 sm:px-6 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted">
            <Monitor size={18} />
          </span>
          <h2 className="mb-1 text-sm font-medium">No services yet</h2>
          <p className="max-w-sm text-[13px] text-muted">
            A service is a screen your ESP32 devices subscribe to. Create one with New service, or start from a{" "}
            <Link href="/templates" className="text-accent hover:underline">
              template
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {errorBox}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <li key={s.id}>
            <ServiceLink
              service={{ id: s.id, name: s.name, enabled: s.enabled }}
              className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-panel transition-colors hover:border-border-strong hover:bg-panel-hover"
            >
              <div className="flex justify-center border-b border-border bg-bg px-4 py-5">
                <ServiceThumb serviceId={s.id} rows={s.draw_ops} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-sm font-medium">{s.name}</h3>
                  <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu size={13} />
                    {s.deviceCount} {s.deviceCount === 1 ? "device" : "devices"}
                  </span>
                  <span title={new Date(s.updated_at).toLocaleString()}>Updated {timeAgo(s.updated_at)}</span>
                </div>
              </div>
            </ServiceLink>
          </li>
        ))}
      </ul>
    </>
  );
}
