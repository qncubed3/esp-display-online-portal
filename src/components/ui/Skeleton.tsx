import PreviewPlaceholder from "@/components/draw/PreviewPlaceholder";
import { cn } from "./cn";

// Grey loading pill with a left-to-right sweep (see `.skeleton` in globals.css). Size it with className.
// Use it only where a value is still loading; keep headings and labels as real text.
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block h-3", className)} />;
}

// Placeholder for a grid of Service-style cards (dashboard, Shared with me). `preview` adds the
// screen preview area the dashboard cards have.
export function CardGridSkeleton({ count = 3, preview = false }: { count?: number; preview?: boolean }) {
  return (
    <ul role="status" aria-label="Loading" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-md border border-border bg-panel">
          {preview && (
            <div className="flex justify-center border-b border-border bg-bg px-4 py-5">
              <PreviewPlaceholder />
            </div>
          )}
          <div className="p-4">
            <div className="mb-6 flex items-start justify-between gap-3">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="w-20" />
              <Skeleton className="w-24" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Placeholder rows for a bordered table whose header is already rendered.
export function TableRowsSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} role="status" aria-label="Loading" className="flex items-center gap-6 border-b border-border px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={c === 0 ? "w-1/5" : c === cols - 1 ? "ml-auto w-16" : "w-1/6"} />
          ))}
        </div>
      ))}
    </>
  );
}

export default Skeleton;
