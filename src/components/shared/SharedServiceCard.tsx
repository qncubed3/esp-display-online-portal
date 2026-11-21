import ServiceCard from "@/components/services/ServiceCard";
import LeaveServiceButton from "@/components/sharing/LeaveServiceButton";
import { Badge } from "@/components/ui/Badge";
import type { SharedService } from "@/lib/lists/types";
import { timeAgo } from "@/lib/time";

// A Service someone shared with you: the same card as My Services, with a "New" badge, when it
// was shared, and a Leave button.
export default function SharedServiceCard({ service: s }: { service: SharedService }) {
  return (
    <ServiceCard
      id={s.id}
      name={s.name}
      enabled={s.enabled}
      deviceCount={s.deviceCount}
      rows={s.draw_ops}
      shared
      badges={s.isNew && <Badge variant="success">New</Badge>}
      date={<span title={new Date(s.addedAt).toLocaleString()}>Added {timeAgo(s.addedAt)}</span>}
      footer={<LeaveServiceButton serviceId={s.id} name={s.name} />}
    />
  );
}
