// Zips firmware files deterministically: fixed entry order and a fixed mtime,
// so the same files always give byte-identical zips.

import { zipSync, type Zippable } from "fflate";
import type { FirmwareFile } from "./files";

// Built from local-time parts, which is how fflate reads it back into the zip's
// DOS timestamp, so the bytes don't depend on the browser's time zone.
const FIXED_MTIME = new Date(2000, 0, 1, 0, 0, 0);

export function zipFirmwareFiles(files: FirmwareFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries: Zippable = {};
  for (const f of files) entries[f.path] = [encoder.encode(f.content), { mtime: FIXED_MTIME }];
  return zipSync(entries, { level: 6 });
}
