"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import SharedServiceCard from "@/components/shared/SharedServiceCard";
import { CardGridSkeleton, skeletonCount } from "@/components/ui/Skeleton";
import { markNotificationsSeen } from "@/lib/sharing/actions";
import { markSharedSeen, useList, useListCount } from "@/lib/store/cache";

// Services shared with the user, from the client cache (refreshed in the background).
export default function SharedList() {
  const { data: services, error } = useList("shared");
  const last = useListCount("shared");
  // Services that were new when this page showed them: they keep their "New" badge while it's open.
  const [shownNew, setShownNew] = useState<ReadonlySet<string>>(() => new Set());

  // Visiting this page reads the notifications. Afterwards the cache forgets they were new.
  useEffect(() => {
    const fresh = services?.filter((s) => s.isNew).map((s) => s.id) ?? [];
    if (!fresh.length) return;
    setShownNew((prev) => new Set([...prev, ...fresh]));
    markNotificationsSeen().then(markSharedSeen, () => {
      // Non-fatal: they'll just show as new again next time.
    });
  }, [services]);

  const errorBox = error && (
    <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
      Could not load shared services: {error}
    </p>
  );

  if (!services) return errorBox || <CardGridSkeleton preview count={skeletonCount(last)} />;

  return (
    <>
      {errorBox}

      {services.length === 0 ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-4 py-16 text-center sm:px-6">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted">
            <Users size={18} />
          </span>
          <p className="max-w-sm text-[13px] text-muted">
            Nothing shared with you yet. When someone adds your email to a Service, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <SharedServiceCard service={shownNew.has(s.id) ? { ...s, isNew: true } : s} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
