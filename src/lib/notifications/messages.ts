// What each notification kind says and where it links, for the bell (listNotifications). Names are
// stored in `data` at the time of the change, so messages still read right after a rename or delete.
// "Added to a Service" isn't a kind: the bell derives it from service_members.

export type NotificationKind =
  | "device_transferred"
  | "member_removed"
  | "member_left"
  | "device_subscribed"
  | "device_unsubscribed"
  | "service_deleted"
  | "service_updated";

export interface NotificationData {
  /** A device was handed to you. */
  device_transferred: { device_id: string; device_name: string; from_email: string };
  /** The owner removed you from their Service. */
  member_removed: { service_id: string; service_name: string; by_email: string };
  /** Someone left your Service. */
  member_left: { service_id: string; service_name: string; member_email: string };
  /** Someone else subscribed their device to your Service. */
  device_subscribed: { service_id: string; service_name: string; device_name: string; owner_email: string };
  /** A device left your Service: its owner moved it, deleted it, or transferred it to someone without access. */
  device_unsubscribed: {
    service_id: string;
    service_name: string;
    device_name: string;
    owner_email: string;
    reason: "moved" | "deleted" | "transferred";
  };
  /** A Service you're a member of, or one your devices were on, was deleted. `devices` = how many of yours were on it. */
  service_deleted: { service_name: string; by_email: string; devices: number };
  /** A Service you have access to (or your devices are on) was renamed or turned on/off. */
  service_updated: {
    service_id: string;
    service_name: string;
    by_email: string;
    change: "renamed" | "enabled" | "disabled";
    old_name?: string;
  };
}

export interface NotificationMessage {
  title: string;
  body: string;
  url: string;
}

const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);

// Tolerates rows with missing fields (data is jsonb). Returns null for unknown kinds.
export function describeNotification(kind: string, raw: Record<string, unknown> | null | undefined): NotificationMessage | null {
  const d = raw ?? {};
  const service = str(d.service_name, "a service");
  const serviceUrl = typeof d.service_id === "string" ? `/services/${d.service_id}` : "/";
  const device = str(d.device_name, "a device");
  switch (kind) {
    case "device_transferred":
      return { title: "Device transferred to you", body: `${str(d.from_email, "Someone")} transferred ${device} to you.`, url: "/devices" };
    case "member_removed":
      return { title: "Removed from a service", body: `${str(d.by_email, "The owner")} removed you from ${service}.`, url: "/shared" };
    case "member_left":
      return { title: "A member left your service", body: `${str(d.member_email, "A member")} left ${service}.`, url: serviceUrl };
    case "device_subscribed":
      return {
        title: "Device added to your service",
        body: `${str(d.owner_email, "Someone")} subscribed ${device} to ${service}.`,
        url: serviceUrl,
      };
    case "device_unsubscribed": {
      const owner = str(d.owner_email, "Its owner");
      const body =
        d.reason === "deleted"
          ? `${owner} deleted ${device}, which was on ${service}.`
          : d.reason === "transferred"
            ? `${owner} transferred ${device} to someone without access, so it left ${service}.`
            : `${owner} moved ${device} off ${service}.`;
      return { title: "Device left your service", body, url: serviceUrl };
    }
    case "service_deleted": {
      const n = typeof d.devices === "number" ? d.devices : 0;
      const tail = n > 0 ? ` ${n === 1 ? "Your device on it is" : `Your ${n} devices on it are`} no longer subscribed to a service.` : "";
      return {
        title: "Service deleted",
        body: `${str(d.by_email, "The owner")} deleted ${service}.${tail}`,
        url: n > 0 ? "/devices" : "/",
      };
    }
    case "service_updated": {
      const by = str(d.by_email, "Someone");
      if (d.change === "renamed")
        return { title: "Service renamed", body: `${by} renamed ${str(d.old_name, "a service")} to ${service}.`, url: serviceUrl };
      if (d.change === "disabled")
        return { title: "Service turned off", body: `${by} turned off ${service}.`, url: serviceUrl };
      return { title: "Service turned on", body: `${by} turned on ${service}.`, url: serviceUrl };
    }
    default:
      return null;
  }
}
