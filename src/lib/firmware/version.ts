// The firmware version the portal generates, and what a device's reported X-FW says it can draw.
// Client-safe (no firmware templates), so the device pages can use it. Bumping firmware only
// changes FW_VERSION here (and FRAME_VERSIONS if the new firmware reads a newer frame schema).

export const FW_NAME = "EspDisplay";
/** Sent by the generated firmware as X-FW. */
export const FW_VERSION = `${FW_NAME}/2.0.0`;
/** "2.0.0" */
export const FW_LATEST = FW_VERSION.slice(FW_NAME.length + 1);

/** The newest frame schema the server sends (see src/lib/draw/frame.ts). */
export const MAX_FRAME_VERSION = 2;

// First firmware release that reads each frame schema. Every release reads all older ones.
const FRAME_VERSIONS: { since: string; frame: number }[] = [
  { since: "2.0.0", frame: 2 },
  { since: "0.0.0", frame: 1 },
];

// "EspDisplay/1.1.0" -> [1, 1, 0]; null if it isn't one of ours.
function parse(fw: string | null | undefined): number[] | null {
  const m = /^EspDisplay\/(\d+)\.(\d+)\.(\d+)/.exec((fw ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** "current" (latest or newer), "outdated", or "unknown" (never reported, or not an EspDisplay version). */
export function firmwareStatus(fw: string | null | undefined): "current" | "outdated" | "unknown" {
  const v = parse(fw);
  if (!v) return "unknown";
  return compare(v, parse(FW_VERSION)!) >= 0 ? "current" : "outdated";
}

/**
 * The frame schema a device can draw, from its latest reported X-FW. A device that has polled
 * without a readable EspDisplay version is treated as v1 (all 1.x firmware, and anything older
 * than X-FW). null when the device has never polled, so nothing is known about it.
 */
export function deviceFrameVersion(fw: string | null | undefined, hasPolled: boolean): number | null {
  const v = parse(fw);
  if (!v) return hasPolled ? 1 : null;
  return FRAME_VERSIONS.find((f) => compare(v, parse(`${FW_NAME}/${f.since}`)!) >= 0)?.frame ?? 1;
}

/** The firmware release that first reads frame schema `frame`, e.g. "EspDisplay 2.0.0". */
export function firmwareForFrame(frame: number): string {
  const since = FRAME_VERSIONS.find((f) => f.frame === frame)?.since ?? FW_LATEST;
  return `${FW_NAME} ${since}`;
}
