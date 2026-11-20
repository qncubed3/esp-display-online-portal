import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";

// The editor needs the Service before it can render, so while it loads show the page's real
// section titles with placeholders where the Service's data goes.
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-panel p-5">
      <h2 className="mb-4 text-[14px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default function Loading() {
  return (
    <AppShell crumbs={[{ label: "My Services", href: "/" }, { label: "…" }]}>
      <div role="status" aria-label="Loading" className="mx-auto max-w-6xl px-4 md:px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-7 w-40 rounded-md" />
        </div>
        <div className="mt-6 flex flex-col gap-5">
          <div className="-mb-1 flex gap-1 border-b border-border text-[13px]">
            <span className="-mb-px border-b-2 border-accent px-3 py-2 text-fg">Devices</span>
            <span className="px-3 py-2 text-muted">Data</span>
            <span className="px-3 py-2 text-muted">Draw</span>
          </div>
          <Card title="Devices">
            <div className="space-y-2.5">
              <Skeleton className="w-1/2" />
              <Skeleton className="w-1/3" />
            </div>
          </Card>
          <Card title="Activity">
            <Skeleton className="h-24 w-full rounded-md" />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
