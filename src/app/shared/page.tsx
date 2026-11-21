import AppShell from "@/components/layout/AppShell";
import SharedList from "@/components/shared/SharedList";

// Services other people shared with the user. The list comes from the client cache
// (src/lib/store/cache.ts) and refreshes in the background.
export default function SharedPage() {
  return (
    <AppShell crumbs={[{ label: "Shared with me" }]}>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <h1 className="mb-6 text-xl font-medium">Shared with me</h1>
        <SharedList />
      </div>
    </AppShell>
  );
}
