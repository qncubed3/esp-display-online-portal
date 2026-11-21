// What a device's screen uses that older firmware can't draw. Shared by the device endpoint (which
// degrades those things for older devices) and the device pages (which flag a device only when its
// firmware is missing something its screen actually uses, not merely because it's older).
//
// Rotated shapes aren't listed: toWireOps expands them into ops every firmware draws.

import { ANGLE_KEY, OP_BY_NAME, fill, hasAngle, type DrawRow, type WireOp } from "./ops";
import { TEXT_ROT_OP, normalizeAngle } from "./rotate";
import { deviceFrameVersion, firmwareForFrame } from "@/lib/firmware/version";

export type Feature = "rotatedText" | "screenFlip";

export const FEATURES: Record<Feature, { minFrame: number; label: string; degraded: string }> = {
  rotatedText: { minFrame: 2, label: "rotated text", degraded: "rotated text shows unrotated" },
  screenFlip: { minFrame: 2, label: "screen flipping", degraded: "the screen flip won't apply" },
};

const ORDER: Feature[] = ["rotatedText", "screenFlip"];

export interface FeatureInput {
  /** The device's orientation setting (devices.rotation): 1 normal, 3 flipped. */
  rotation?: number | null;
  /** The Service's saved Draw rows; a {var} rotation counts as used unless `vars` says it's 0. */
  rows?: DrawRow[] | null;
  /** Data variables, when known (the endpoint has them). */
  vars?: Record<string, unknown>;
  /** Ops actually sent (the endpoint, after Data ran). Takes precedence over `rows`. */
  ops?: WireOp[];
  /** Features already worked out for the content (e.g. by the server), merged in. */
  uses?: Feature[];
}

/** The features a device's screen uses that need a frame schema newer than v1. Empty when v1 draws it all. */
export function featuresNeeded({ rotation, rows, vars, ops, uses }: FeatureInput): Feature[] {
  const found = new Set<Feature>(uses ?? []);
  if (rotation === 3) found.add("screenFlip");
  if (ops) {
    if (ops.some((op) => Array.isArray(op) && op[0] === TEXT_ROT_OP)) found.add("rotatedText");
  } else if (Array.isArray(rows)) {
    for (const row of rows) {
      const def = row && typeof row === "object" ? OP_BY_NAME[row.op] : undefined;
      if (!def || !hasAngle(def) || !def.fields.some((f) => f.key === ANGLE_KEY && f.minFrame && f.minFrame > 1)) continue;
      const raw = row.args?.[ANGLE_KEY];
      if (raw === undefined || raw === "") continue;
      const isVar = typeof raw === "string" && /\{\w+\}/.test(raw);
      const value = isVar ? (vars ? fill(raw, vars) : null) : raw;
      if (value === null || normalizeAngle(value) !== 0) found.add("rotatedText");
    }
  }
  return ORDER.filter((f) => found.has(f));
}

/** The features `needed` that a device reading frame schema `frameVersion` can't draw. */
export function missingFeatures(needed: Feature[], frameVersion: number | null): Feature[] {
  if (frameVersion === null) return [];
  return needed.filter((f) => FEATURES[f].minFrame > frameVersion);
}

/** "Rotated text shows unrotated and the screen flip won't apply until you reflash with EspDisplay 2.0.0." */
export function missingSentence(missing: Feature[]): string {
  if (!missing.length) return "";
  const parts = missing.map((f) => FEATURES[f].degraded);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  const need = Math.max(...missing.map((f) => FEATURES[f].minFrame));
  return `${text[0].toUpperCase()}${text.slice(1)} until you reflash with ${firmwareForFrame(need)}.`;
}

/**
 * What one device's screen uses that its firmware can't draw yet: its orientation plus its
 * Service's content (`contentNeeds`, worked out on the server), against the frame schema its
 * latest X-FW says it reads. Empty for devices that have never polled.
 */
export function deviceMissingFeatures(d: {
  rotation?: number | null;
  contentNeeds: Feature[];
  fw: string | null;
  polled: boolean;
}): Feature[] {
  return missingFeatures(featuresNeeded({ rotation: d.rotation, uses: d.contentNeeds }), deviceFrameVersion(d.fw, d.polled));
}
