// The firmware version the portal generates, and what a device's reported X-FW says it can draw.
// Client-safe (no firmware templates), so the device pages can use it.
//
// Firmware versions are plain numbers: v1, v2, ... The generated firmware sends "EspDisplay/v2";
// devices flashed before that send semver ("EspDisplay/1.1.0"), and only the major number counts.
// Bumping firmware only changes FW_MAJOR here (and FRAME_VERSIONS if it reads a newer frame schema).

export const FW_NAME = "EspDisplay";
export const FW_MAJOR = 2;
/** Sent by the generated firmware as X-FW. */
export const FW_VERSION = `${FW_NAME}/v${FW_MAJOR}`;
/** "v2" */
export const FW_LATEST = `v${FW_MAJOR}`;

/** The newest frame schema the server sends (see src/lib/draw/frame.ts). */
export const MAX_FRAME_VERSION = 2;

// First firmware version that reads each frame schema. Every version reads all older ones.
const FRAME_VERSIONS: { since: number; frame: number }[] = [
  { since: 2, frame: 2 },
  { since: 0, frame: 1 },
];

// "EspDisplay/v2" -> 2, "EspDisplay/1.1.0" -> 1; null if it isn't one of ours.
function parse(fw: string | null | undefined): number | null {
  const m = /^EspDisplay\/v?(\d+)/.exec((fw ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** "v1", "v2", ...; null when the device hasn't reported an EspDisplay version. */
export function firmwareLabel(fw: string | null | undefined): string | null {
  const v = parse(fw);
  return v === null ? null : `v${v}`;
}

/** "current" (latest or newer), "outdated", or "unknown" (never reported, or not an EspDisplay version). */
export function firmwareStatus(fw: string | null | undefined): "current" | "outdated" | "unknown" {
  const v = parse(fw);
  if (v === null) return "unknown";
  return v >= FW_MAJOR ? "current" : "outdated";
}

/**
 * The frame schema a device can draw, from its latest reported X-FW. A device that has polled
 * without a readable EspDisplay version is treated as v1 (all v1 firmware, and anything older
 * than X-FW). null when the device has never polled, so nothing is known about it.
 */
export function deviceFrameVersion(fw: string | null | undefined, hasPolled: boolean): number | null {
  const v = parse(fw);
  if (v === null) return hasPolled ? 1 : null;
  return FRAME_VERSIONS.find((f) => v >= f.since)?.frame ?? 1;
}

/** The firmware that first reads frame schema `frame`, e.g. "firmware v2". */
export function firmwareForFrame(frame: number): string {
  const since = FRAME_VERSIONS.find((f) => f.frame === frame)?.since ?? FW_MAJOR;
  return `firmware v${since}`;
}
