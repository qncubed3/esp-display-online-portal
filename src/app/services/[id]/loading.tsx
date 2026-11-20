import { Code2, Cpu, LayoutTemplate, Plus, Rocket, Shapes, Share2, Trash2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

// Shown while the Service loads. Everything that doesn't depend on the Service (buttons, tabs,
// section titles and descriptions) is the real UI, disabled; only the name and the data are pills.
export default function Loading() {
  return (
    <AppShell crumbs={[{ label: "My Services", href: "/" }, { label: "…" }]}>
      <div role="status" aria-label="Loading" className="mx-auto flex min-h-full max-w-6xl flex-col px-4 pt-6 md:px-6">
        {/* Header: name and badge are data; the controls are real but disabled until it loads. */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 text-[13px] text-muted">
              <span className="inline-block h-5 w-9 rounded-full border border-border bg-panel-hover" aria-hidden />
              Enabled
            </span>
            <Button size="sm" disabled>
              <Share2 size={14} />
              Share
            </Button>
            <Button size="sm" variant="danger" disabled>
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5">
          <div className="-mb-1 flex gap-1 border-b border-border text-[13px]">
            <span className="-mb-px inline-flex h-9 items-center gap-2 border-b-2 border-accent px-2.5 text-fg sm:px-3">
              <Cpu size={14} /> Devices
            </span>
            <span className="inline-flex h-9 items-center gap-2 px-2.5 text-muted sm:px-3">
              <Code2 size={14} /> Data
            </span>
            <span className="inline-flex h-9 items-center gap-2 px-2.5 text-muted sm:px-3">
              <Shapes size={14} /> Draw
            </span>
            <div className="ml-auto flex shrink-0 items-center pb-1">
              <Button size="sm" variant="ghost" disabled aria-label="Load template">
                <LayoutTemplate size={14} />
                <span className="hidden sm:inline">Load template</span>
              </Button>
            </div>
          </div>

          <section className="rounded-md border border-border bg-panel p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <div className="min-w-0">
                <h2 className="text-[14px] font-medium">Devices</h2>
                <p className="text-muted">
                  ESP32 screens subscribed to this service. <span className="text-accent">Manage all devices →</span>
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2.5 py-1.5 font-medium text-accent/60">
                <Plus size={14} /> Add device
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="w-1/2" />
              <Skeleton className="w-1/3" />
            </div>
          </section>

          <section className="rounded-md border border-border bg-panel p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-medium">Activity</h2>
              <div className="flex gap-1 text-[12px] text-muted">
                <span className="rounded px-2 py-0.5">1h</span>
                <span className="rounded bg-panel-hover px-2 py-0.5 text-fg">24h</span>
                <span className="rounded px-2 py-0.5">7d</span>
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="w-2/3" />
              <Skeleton className="w-1/2" />
              <Skeleton className="w-3/5" />
            </div>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-border bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <div className="flex items-center justify-end gap-3">
              <Button variant="primary" disabled>
                <Rocket size={14} />
                Save &amp; deploy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
