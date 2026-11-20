import AppShell, { type Crumb } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";

// Instant placeholder for a signed-in page while its server data loads (used by route loading.tsx files).
// The shell (sidebar, top bar, crumbs) renders straight away; data areas show sweeping grey pills.
export type SkeletonVariant = "cards" | "table" | "service" | "overview" | "docs" | "settings";

const panel = "rounded-md border border-border bg-panel";

function Heading({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      {action && <Skeleton className="h-7 w-28" />}
    </div>
  );
}

function Lines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-2.5">
      {widths.map((w, i) => (
        <Skeleton key={i} className={w} />
      ))}
    </div>
  );
}

function Cards() {
  return (
    <>
      <Heading />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${panel} p-4`}>
            <Skeleton className="mb-4 h-3.5 w-2/3" />
            <Lines widths={["w-1/3", "w-1/2"]} />
          </div>
        ))}
      </div>
    </>
  );
}

function Table() {
  return (
    <>
      <Heading />
      <div className="mb-4 flex gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${panel} flex-1 p-4`}>
            <Skeleton className="mb-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
      <div className={panel}>
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="w-1/3" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
            <Skeleton className="h-2.5 w-2.5" />
            <Skeleton className="w-1/5" />
            <Skeleton className="w-1/6" />
            <Skeleton className="ml-auto w-1/6" />
          </div>
        ))}
      </div>
    </>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${panel} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-7 w-24" />
      </div>
      {children}
    </div>
  );
}

function Service() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <Section>
          <Lines widths={["w-1/2", "w-1/3"]} />
        </Section>
        <Section>
          <Skeleton className="h-28 w-full rounded-md" />
        </Section>
        <Section>
          <div className="flex flex-col gap-5 xl:flex-row">
            <div className="flex-1 space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
            <Skeleton className="aspect-[4/3] w-full rounded-md xl:w-[480px]" />
          </div>
        </Section>
      </div>
    </>
  );
}

function Overview() {
  return (
    <>
      <Heading />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${panel} p-4`}>
            <Skeleton className="mb-3 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
      <Table />
    </>
  );
}

function Docs() {
  return (
    <div className="flex gap-8">
      <div className="hidden w-48 shrink-0 lg:block">
        <Lines widths={["w-24", "w-28", "w-20", "w-32", "w-24", "w-20", "w-16"]} />
      </div>
      <div className="min-w-0 flex-1 space-y-8">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <Skeleton className="mb-4 h-4 w-48" />
            <Lines widths={["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div className="max-w-2xl space-y-5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className={`${panel} p-5`}>
          <Skeleton className="mb-4 h-3.5 w-32" />
          <Lines widths={["w-1/2", "w-2/3"]} />
          <Skeleton className="mt-4 h-8 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

const VARIANTS: Record<SkeletonVariant, () => React.ReactNode> = {
  cards: Cards,
  table: Table,
  service: Service,
  overview: Overview,
  docs: Docs,
  settings: Settings,
};

export default function PageSkeleton({ variant, crumbs }: { variant: SkeletonVariant; crumbs: Crumb[] }) {
  const Body = VARIANTS[variant];
  return (
    <AppShell crumbs={crumbs}>
      <div role="status" aria-label="Loading" className="mx-auto max-w-6xl px-6 py-6">
        <Body />
      </div>
    </AppShell>
  );
}
