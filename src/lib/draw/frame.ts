// Builds the Frame the device endpoint sends, in the schema the device asked for.
//
// Negotiation: firmware v2+ sends `X-Frame-Version: 2` and gets a v2 frame; a request without it
// (every v1 device) gets a v1 frame, exactly as before v2 existed, with anything v1 can't draw
// degraded rather than broken: drawStringRot becomes a plain drawString (text unrotated) and the
// device's orientation is left out (v1 firmware always draws landscape, rotation 1).
//
// The id is a hash of everything that changes what's drawn, so a new orientation forces a redraw:
// v1: the ops (unchanged from before v2, so v1 devices don't redraw just because of a deploy);
// v2: the version, the orientation and the ops.

import { createHash } from "node:crypto";
import type { Frame, WireOp } from "./ops";
import { toV1Ops } from "./rotate";
import { MAX_FRAME_VERSION } from "@/lib/firmware/version";

/** The schema to send for a request's X-Frame-Version header: 1 when missing or unreadable. */
// (A future v3 device asking for 3 still gets v2: every firmware reads all older schemas.)
export function requestedFrameVersion(header: string | null): 1 | 2 {
  const n = Number((header ?? "").trim());
  return Number.isInteger(n) && n >= MAX_FRAME_VERSION ? MAX_FRAME_VERSION : 1;
}

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);

export function buildFrame(ops: WireOp[], o: { version: 1 | 2; rotation: number | null | undefined; poll: number }): Frame {
  if (o.version === 1) {
    const v1 = toV1Ops(ops);
    return { v: 1, id: hash(v1), next: o.poll, poll: o.poll, ops: v1 };
  }
  const rot = o.rotation === 3 ? 3 : 1;
  return { v: 2, id: hash([2, rot, ops]), next: o.poll, poll: o.poll, rot, ops };
}
