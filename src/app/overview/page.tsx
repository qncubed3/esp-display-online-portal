import AppShell from "@/components/layout/AppShell";
import OverviewView from "@/components/overview/OverviewView";

export const metadata = { title: "Overview" };

// Renders straight away; stats load client-side from GET /api/overview and refresh every 30s.
export default function OverviewPage() {
  return (
    <AppShell crumbs={[{ label: "Overview" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <OverviewView />
      </div>
    </AppShell>
  );
}
