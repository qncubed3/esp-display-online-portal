// Row shapes for the cached lists (My Services, Shared with me, Devices). Safe to import from client code.

import type { DeviceListRow } from "@/lib/device-list/types";
import type { SubscribableService } from "@/lib/devices/actions";
import type { DrawRow } from "@/lib/draw/ops";

/** A card on My Services. */
export interface ServiceCard {
  id: string;
  name: string;
  enabled: boolean;
  updated_at: string;
  draw_ops: DrawRow[];
  deviceCount: number;
}

/** A card on Shared with me. */
export interface SharedService {
  id: string;
  name: string;
  enabled: boolean;
  deviceCount: number;
  draw_ops: DrawRow[];
  addedAt: string;
  isNew: boolean; // not yet seen (service_members.seen_at is null)
}

export interface Lists {
  services: ServiceCard[];
  shared: SharedService[];
  devices: DeviceListRow[];
  subscribable: SubscribableService[]; // the Service dropdowns on /devices
}

export type ListName = keyof Lists;

export const LIST_NAMES: ListName[] = ["services", "shared", "devices", "subscribable"];

export function isListName(v: string): v is ListName {
  return (LIST_NAMES as string[]).includes(v);
}
