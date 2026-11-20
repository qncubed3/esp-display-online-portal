import AppShell from "@/components/layout/AppShell";
import OverviewView from "@/components/overview/OverviewView";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Overview" };

// Shell renders on the server; stats load client-side from GET /api/overview and refresh every 30s.
export default async function OverviewPage() {
  const { user } = await requireUser();
  return (
    <AppShell email={user.email ?? ""} crumbs={[{ label: "Overview" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <OverviewView />
      </div>
    </AppShell>
  );
}
