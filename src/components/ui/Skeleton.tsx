import { cn } from "./cn";

// Grey loading pill with a left-to-right sweep (see `.skeleton` in globals.css). Size it with className.
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block h-3", className)} />;
}

export default Skeleton;
