import Link from "next/link";
import { Cpu, Monitor } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import NewServiceButton from "@/components/services/NewServiceButton";
import { Badge } from "@/components/ui/Badge";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/time";

type ServiceCard = {
  id: string;
  name: string;
  enabled: boolean;
  updated_at: string;
  devices: { count: number }[];
};

// Dashboard: the user's own Services. Shared ones live on /shared.
export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const [{ data, error }, { count: sharedCount }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, enabled, updated_at, devices(count)")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("service_members").select("service_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const services = (data ?? []) as ServiceCard[];
  const shared = sharedCount ?? 0;

  return (
    <AppShell email={user.email ?? ""} crumbs={[{ label: "My Services" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-medium">My Services</h1>
            {shared > 0 && (
              <Link href="/shared" className="text-[13px] text-muted transition-colors hover:text-fg">
                {shared} shared with you →
              </Link>
            )}
          </div>
          {services.length > 0 && <NewServiceButton />}
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">
            Could not load services: {error.message}
          </p>
        )}

        {services.length === 0 && !error ? (
          <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-6 py-16 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted">
              <Monitor size={18} />
            </span>
            <h2 className="mb-1 text-sm font-medium">No services yet</h2>
            <p className="mb-5 max-w-sm text-[13px] text-muted">
              A service is a screen your ESP32 devices subscribe to. Create one to start designing.
            </p>
            <NewServiceButton size="md" />
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const deviceCount = s.devices?.[0]?.count ?? 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/services/${s.id}`}
                    className="block h-full rounded-md border border-border bg-panel p-4 transition-colors hover:border-border-strong hover:bg-panel-hover"
                  >
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <h3 className="truncate text-sm font-medium">{s.name}</h3>
                      <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Cpu size={13} />
                        {deviceCount} {deviceCount === 1 ? "device" : "devices"}
                      </span>
                      <span title={new Date(s.updated_at).toLocaleString()}>Updated {timeAgo(s.updated_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
