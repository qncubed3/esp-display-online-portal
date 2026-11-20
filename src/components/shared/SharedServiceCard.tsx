import { Cpu } from "lucide-react";
import ServiceLink from "@/components/services/ServiceLink";
import LeaveServiceButton from "@/components/sharing/LeaveServiceButton";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/time";

export interface SharedService {
  id: string;
  name: string;
  enabled: boolean;
  deviceCount: number;
  addedAt: string;
  isNew: boolean;
}

// A Service someone shared with you. The whole box links to the Service; the Leave
// button sits above the link overlay so it stays clickable (no nested interactive elements).
export default function SharedServiceCard({ service: s }: { service: SharedService }) {
  return (
    <div className="relative h-full rounded-md border border-border bg-panel p-4 transition-colors hover:border-border-strong hover:bg-panel-hover">
      <div className="mb-6 flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-medium">
          <ServiceLink
            service={{ id: s.id, name: s.name, enabled: s.enabled, shared: true }}
            className="after:absolute after:inset-0 after:rounded-md"
          >
            {s.name}
          </ServiceLink>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {s.isNew && <Badge variant="success">New</Badge>}
          <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Cpu size={13} />
          {s.deviceCount} {s.deviceCount === 1 ? "device" : "devices"}
        </span>
        <span title={new Date(s.addedAt).toLocaleString()}>Added {timeAgo(s.addedAt)}</span>
      </div>
      <div className="relative z-10 mt-3 flex justify-end border-t border-border pt-3">
        <LeaveServiceButton serviceId={s.id} name={s.name} />
      </div>
    </div>
  );
}
