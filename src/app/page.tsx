import AppShell from "@/components/layout/AppShell";
import NewServiceButton from "@/components/services/NewServiceButton";
import ServiceGrid, { SharedLink } from "@/components/services/ServiceGrid";

// Dashboard: the user's own Services. Shared ones live on /shared.
// The heading renders straight away; the grid comes from the client cache (src/lib/store/cache.ts),
// so it shows at once when the list was loaded before, and refreshes in the background.
export default function DashboardPage() {
  return (
    <AppShell crumbs={[{ label: "My Services" }]}>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-medium">My Services</h1>
            <SharedLink />
          </div>
          <NewServiceButton />
        </div>
        <ServiceGrid />
      </div>
    </AppShell>
  );
}
