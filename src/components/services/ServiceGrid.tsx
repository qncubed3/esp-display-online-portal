"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";
import ServiceCard from "@/components/services/ServiceCard";
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
            <ServiceCard
              id={s.id}
              name={s.name}
              enabled={s.enabled}
              deviceCount={s.deviceCount}
              rows={s.draw_ops}
              date={<span title={new Date(s.updated_at).toLocaleString()}>Updated {timeAgo(s.updated_at)}</span>}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
