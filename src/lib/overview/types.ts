// Shapes returned by loadOverview / GET /api/overview. Safe to import from client code.

import type { ActivityRange } from "@/lib/polls/types";

// Vercel Hobby plan: 1,000,000 function invocations per month. Every device poll is one invocation.
export const HOBBY_INVOCATIONS_PER_MONTH = 1_000_000;
// One device polling every 30 s: 2 per minute × 60 × 24 × 30 days.
export const POLLS_PER_DEVICE_MONTH_30S = 86_400;

export interface OverviewBucket {
  t: number; // bucket start, epoch ms
  count: number;
  ok: number; // 200 without a Data error
  notModified: number; // 304
  disabled: number; // 204
  error: number; // 5xx, Data error, or anything else
  avgMs: number | null;
  p95Ms: number | null;
}

export interface OverviewService {
  id: string;
  name: string;
  enabled: boolean;
  shared: boolean; // the user is a member, not the owner
  devices: number;
  devicesOnline: number;
  polls: number; // in range (exact count)
  successRate: number | null; // over fetched polls in range
  avgMs: number | null;
  errors: number;
  lastPollAt: string | null; // latest device last_seen_at, any time
}

export interface OverviewSummary {
  polls: number; // exact count in range
  successRate: number | null;
  avgMs: number | null;
  p95Ms: number | null;
  devicesOnline: number;
  devicesTotal: number;
  servicesEnabled: number;
  servicesTotal: number;
}

export interface OverviewBudget {
  polls7d: number; // exact count of polls in the last 7 days
  estimatedPerMonth: number; // polls7d × 30 / 7
  limit: number;
  devicesThatFit: number; // devices at 30 s polling that fit in the limit
}

export interface Overview {
  range: ActivityRange;
  from: number; // epoch ms
  to: number;
  bucketMs: number;
  generatedAt: string;
  truncated: boolean; // range had more polls than were fetched; stats use the newest ones
  fetched: number; // polls the stats are computed over
  summary: OverviewSummary;
  buckets: OverviewBucket[];
  services: OverviewService[];
  budget: OverviewBudget;
}
