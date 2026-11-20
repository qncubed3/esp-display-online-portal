import { Suspense } from "react";
import { Users } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import SharedServiceCard, { type SharedService } from "@/components/shared/SharedServiceCard";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import { markNotificationsSeen } from "@/lib/sharing/actions";

type Row = {
  created_at: string;
  seen_at: string | null;
  services:
    | { id: string; name: string; enabled: boolean; devices: { count: number }[] }
    | { id: string; name: string; enabled: boolean; devices: { count: number }[] }[]
    | null;
};

export default function SharedPage() {
  return (
    <AppShell crumbs={[{ label: "Shared with me" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-xl font-medium">Shared with me</h1>
        <Suspense fallback={<CardGridSkeleton />}>
          <SharedList />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function SharedList() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("service_members")
    .select("created_at, seen_at, services(id, name, enabled, devices(count))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const services: SharedService[] = ((data ?? []) as unknown as Row[]).flatMap((r) => {
    const svc = Array.isArray(r.services) ? r.services[0] : r.services;
    if (!svc) return [];
    return [
      {
        id: svc.id,
        name: svc.name,
        enabled: svc.enabled,
        deviceCount: svc.devices?.[0]?.count ?? 0,
        addedAt: r.created_at,
        isNew: r.seen_at === null,
      },
    ];
  });

  // Visiting this page reads the notifications. "New" badges above use the state from before.
  if (services.some((s) => s.isNew)) {
    try {
      await markNotificationsSeen();
    } catch {
      // Non-fatal: they'll just show as new again next time.
    }
  }

  return (
    <>
        {error && (
          <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
            Could not load shared services: {error.message}
          </p>
        )}

        {services.length === 0 && !error ? (
          <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-6 py-16 text-center">
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
                <SharedServiceCard service={s} />
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
