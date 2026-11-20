// Direct manipulation on the Draw preview: which handles a row's shape gets, and how dragging the
// shape or a handle changes the row's numbers. Works on DrawRows (not WireOps) so edits land in the
// editor; a row whose coordinates use {variables} can't be dragged (there's no number to change).

import type { DrawRow } from "./ops";

export interface Handle {
  id: string;
  x: number;
  y: number;
  cursor: string;
}

const RECTS = new Set(["drawRect", "fillRect", "drawRoundRect", "fillRoundRect"]);
const CIRCLES = new Set(["drawCircle", "fillCircle"]);
const X_KEYS = ["x", "x0", "x1", "x2"];
const Y_KEYS = ["y", "y0", "y1", "y2"];
const SIZE_KEYS = ["w", "h", "r"];

const literal = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && /^\s*-?\d+\s*$/.test(v)) return Number(v);
  return null;
};

// The row's geometry fields as numbers, or null if any of them isn't a plain number.
function numbers(row: DrawRow): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const k of [...X_KEYS, ...Y_KEYS, ...SIZE_KEYS]) {
    if (!(k in row.args)) continue;
    const n = literal(row.args[k]);
    if (n === null) return null;
    out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

export function canDrag(row: DrawRow): boolean {
  return row.op !== "fillScreen" && numbers(row) !== null;
}

export function handlesFor(row: DrawRow): Handle[] {
  const n = numbers(row);
  if (!n) return [];
  if (RECTS.has(row.op)) {
    const r = n.x + n.w - 1, b = n.y + n.h - 1;
    return [
      { id: "nw", x: n.x, y: n.y, cursor: "nwse-resize" },
      { id: "ne", x: r, y: n.y, cursor: "nesw-resize" },
      { id: "sw", x: n.x, y: b, cursor: "nesw-resize" },
      { id: "se", x: r, y: b, cursor: "nwse-resize" },
    ];
  }
  if (row.op === "drawFastHLine") return [{ id: "e", x: n.x + n.w - 1, y: n.y, cursor: "ew-resize" }];
  if (row.op === "drawFastVLine") return [{ id: "s", x: n.x, y: n.y + n.h - 1, cursor: "ns-resize" }];
  if (CIRCLES.has(row.op)) return [{ id: "e", x: n.x + n.r, y: n.y, cursor: "ew-resize" }];
  if (row.op === "drawLine" || row.op === "drawTriangle" || row.op === "fillTriangle") {
    const count = row.op === "drawLine" ? 2 : 3;
    return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, x: n[`x${i}`], y: n[`y${i}`], cursor: "move" }));
  }
  return [];
}

// `start` is the row as it was when the drag began; dx/dy are screen pixels moved since then.
export function applyDrag(start: DrawRow, handle: string, dx: number, dy: number): DrawRow {
  const n = numbers(start);
  if (!n) return start;
  const set: Record<string, number> = {};

  if (handle === "move") {
    for (const k of X_KEYS) if (k in n) set[k] = n[k] + dx;
    for (const k of Y_KEYS) if (k in n) set[k] = n[k] + dy;
  } else if (RECTS.has(start.op)) {
    const right = n.x + n.w, bottom = n.y + n.h;
    if (handle.includes("w")) {
      set.x = Math.min(n.x + dx, right - 1);
      set.w = right - set.x;
    }
    if (handle.includes("e")) set.w = Math.max(1, n.w + dx);
    if (handle.includes("n")) {
      set.y = Math.min(n.y + dy, bottom - 1);
      set.h = bottom - set.y;
    }
    if (handle.includes("s")) set.h = Math.max(1, n.h + dy);
  } else if (handle === "e" && start.op === "drawFastHLine") {
    set.w = Math.max(1, n.w + dx);
  } else if (handle === "s" && start.op === "drawFastVLine") {
    set.h = Math.max(1, n.h + dy);
  } else if (handle === "e" && CIRCLES.has(start.op)) {
    set.r = Math.max(0, n.r + dx);
  } else if (/^p\d$/.test(handle)) {
    const i = handle[1];
    set[`x${i}`] = n[`x${i}`] + dx;
    set[`y${i}`] = n[`y${i}`] + dy;
  }

  return { ...start, args: { ...start.args, ...set } };
}
