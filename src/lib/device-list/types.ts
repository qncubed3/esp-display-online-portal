// Row shape for the /devices page. Safe to import from client code.

export interface DeviceListRow {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  shared: boolean; // Service owned by someone else
  lastSeenAt: string | null;
  online: boolean; // seen in the last 2 minutes
  polls24h: number;
  // From the latest logged poll (any time); null when never logged or header not sent.
  fw: string | null;
  rssi: number | null;
  heap: number | null;
  uptimeS: number | null;
  lastStatus: number | null;
  lastError: string | null;
  lastPollAt: string | null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

// 0..4 bars from dBm.
export function signalBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}
