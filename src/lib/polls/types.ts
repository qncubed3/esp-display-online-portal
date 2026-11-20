// Shapes returned by getServiceActivity / GET /api/services/[id]/activity. Safe to import from client code.

export type ActivityRange = "1h" | "24h" | "7d";
export const ACTIVITY_RANGES: ActivityRange[] = ["1h", "24h", "7d"];

export function isActivityRange(v: unknown): v is ActivityRange {
  return v === "1h" || v === "24h" || v === "7d";
}

export interface DeviceActivity {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean; // seen in the last 2 minutes
  polls: number; // in range
  successRate: number | null; // 0..1, null when no polls in range
  avgMs: number | null;
  p95Ms: number | null;
  // From the device's latest logged poll (any time), if it sent the headers.
  rssi: number | null;
  heap: number | null;
  fw: string | null;
  uptimeS: number | null;
  ip: string | null;
}

export interface ActivityBucket {
  t: number; // bucket start, epoch ms
  count: number;
  ok: number; // 200 without a Data error
  notModified: number; // 304
  disabled: number; // 204
  error: number; // 5xx or Data error
  avgMs: number | null;
  p95Ms: number | null;
  avgDataMs: number | null;
  avgRssi: number | null;
}

export interface RecentPoll {
  id: number;
  at: string;
  deviceId: string;
  deviceName: string;
  status: number;
  durationMs: number;
  dataMs: number | null;
  bytes: number | null;
  ops: number | null;
  error: string | null;
  rssi: number | null;
}

export interface ActivitySummary {
  polls: number;
  successRate: number | null;
  avgMs: number | null;
  p95Ms: number | null;
  devicesOnline: number;
  devicesTotal: number;
}

export interface ServiceActivity {
  range: ActivityRange;
  from: number; // epoch ms
  to: number;
  bucketMs: number;
  generatedAt: string;
  truncated: boolean; // true when the range had more polls than were fetched (oldest ones dropped)
  summary: ActivitySummary;
  devices: DeviceActivity[];
  buckets: ActivityBucket[];
  recent: RecentPoll[]; // latest 50, any time
}
