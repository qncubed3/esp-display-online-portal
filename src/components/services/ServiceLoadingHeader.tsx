"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toggle } from "@/components/ui/Toggle";
import { knownService } from "@/lib/services/known";

function useKnown() {
  const { id } = useParams<{ id: string }>();
  return knownService(id);
}

// Breadcrumbs for the loading screen: the parent list and the Service name, if the link knew them.
export function LoadingParentCrumb() {
  const shared = useKnown()?.shared;
  return (
    <Link href={shared ? "/shared" : "/"} className="truncate text-muted hover:text-fg">
      {shared ? "Shared with me" : "My Services"}
    </Link>
  );
}

export function LoadingNameCrumb() {
  return <>{useKnown()?.name ?? "…"}</>;
}

// Name, status badge and Enabled toggle, prefilled from the clicked link; pills for what it didn't know.
export function LoadingTitle() {
  const s = useKnown();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {s ? <h1 className="truncate text-xl font-medium">{s.name}</h1> : <Skeleton className="h-4 w-44" />}
      {s?.enabled === undefined ? (
        <Skeleton className="w-14" />
      ) : (
        <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
      )}
      {s?.shared && <Badge className="shrink-0">Shared with you</Badge>}
    </div>
  );
}

export function LoadingEnabledToggle() {
  return <Toggle checked={useKnown()?.enabled ?? false} onChange={() => {}} disabled label="Enabled" />;
}
