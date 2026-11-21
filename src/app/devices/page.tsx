import AppShell from "@/components/layout/AppShell";
import DevicesContent from "@/components/device-list/DevicesContent";

// The user's devices. The list comes from the client cache (src/lib/store/cache.ts) and refreshes
// in the background.
export default function DevicesPage() {
  return (
    <AppShell crumbs={[{ label: "Devices" }]}>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <h1 className="mb-6 text-xl font-medium">Devices</h1>
        <DevicesContent />
      </div>
    </AppShell>
  );
}
