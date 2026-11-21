import { Suspense } from "react";
import Link from "next/link";
import { Cpu, Monitor } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import NewServiceButton from "@/components/services/NewServiceButton";
import ServiceLink from "@/components/services/ServiceLink";
import ServiceThumb from "@/components/services/ServiceThumb";
import { Badge } from "@/components/ui/Badge";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { requireUser } from "@/lib/auth";
import type { DrawRow } from "@/lib/draw/ops";
import { timeAgo } from "@/lib/time";

type ServiceCard = {
  id: string;
  name: string;
  enabled: boolean;
  updated_at: string;
  draw_ops: DrawRow[] | null;
  devices: { count: number }[];
};

// Dashboard: the user's own Services. Shared ones live on /shared.
// The heading renders straight away; the link and the grid stream in when their data arrives.
export default function DashboardPage() {
  return (
    <AppShell crumbs={[{ label: "My Services" }]}>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-medium">My Services</h1>
            <Suspense fallback={null}>
              <SharedLink />
            </Suspense>
          </div>
          <NewServiceButton />
        </div>
        <Suspense fallback={<CardGridSkeleton preview />}>
          <ServiceGrid />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function SharedLink() {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("service_members")
    .select("service_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!count) return null;
  return (
    <Link href="/shared" className="text-[13px] text-muted transition-colors hover:text-fg">
      {count} shared with you →
    </Link>
  );
}

async function ServiceGrid() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, enabled, updated_at, draw_ops, devices(count)")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  const services = (data ?? []) as ServiceCard[];

  if (error) {
    return (
      <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
        Could not load services: {error.message}
      </p>
    );
  }

  if (services.length === 0) {
    return (
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
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => {
        const deviceCount = s.devices?.[0]?.count ?? 0;
        return (
          <li key={s.id}>
            <ServiceLink
              service={{ id: s.id, name: s.name, enabled: s.enabled }}
              className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-panel transition-colors hover:border-border-strong hover:bg-panel-hover"
            >
              <div className="flex justify-center border-b border-border bg-bg px-4 py-5">
                <ServiceThumb serviceId={s.id} rows={Array.isArray(s.draw_ops) ? s.draw_ops : []} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-sm font-medium">{s.name}</h3>
                  <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu size={13} />
                    {deviceCount} {deviceCount === 1 ? "device" : "devices"}
                  </span>
                  <span title={new Date(s.updated_at).toLocaleString()}>Updated {timeAgo(s.updated_at)}</span>
                </div>
              </div>
            </ServiceLink>
          </li>
        );
      })}
    </ul>
  );
}
