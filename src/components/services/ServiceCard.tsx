import type { ReactNode } from "react";
import { Cpu } from "lucide-react";
import ServiceLink from "@/components/services/ServiceLink";
import ServiceThumb from "@/components/services/ServiceThumb";
import { Badge } from "@/components/ui/Badge";
import type { DrawRow } from "@/lib/draw/ops";

// A Service card for My Services and Shared with me: screen preview, name, status, device count and
// a date line. The whole card links to the Service through an overlay on the name's link, so a
// `footer` (e.g. Leave) can sit above the overlay and stay clickable without nesting interactive
// elements.
export default function ServiceCard({
  id,
  name,
  enabled,
  deviceCount,
  rows,
  shared = false,
  badges,
  owner,
  date,
  footer,
}: {
  id: string;
  name: string;
  enabled: boolean;
  deviceCount: number;
  rows: DrawRow[];
  shared?: boolean;
  /** Extra badges before the Enabled/Disabled one, e.g. "New". */
  badges?: ReactNode;
  /** Shown as "By <owner>" under the name (shared Services: the owner's email). */
  owner?: string | null;
  /** Right side of the bottom line, e.g. "Updated 2h ago". */
  date: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-panel transition-colors hover:border-border-strong hover:bg-panel-hover">
      <div className="flex justify-center border-b border-border bg-bg px-4 py-5">
        <ServiceThumb serviceId={id} rows={rows} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">
              <ServiceLink service={{ id, name, enabled, shared }} className="after:absolute after:inset-0 after:rounded-md">
                {name}
              </ServiceLink>
            </h3>
            {owner && (
              <p className="mt-0.5 truncate text-[12px] text-muted" title={owner}>
                By {owner}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {badges}
            <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Cpu size={13} />
            {deviceCount} {deviceCount === 1 ? "device" : "devices"}
          </span>
          {date}
        </div>
        {footer && <div className="relative z-10 mt-3 flex justify-end border-t border-border pt-3">{footer}</div>}
      </div>
    </div>
  );
}
