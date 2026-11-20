// Direct manipulation on the Draw preview: which handles a row's shape gets, and how dragging the
// shape or a handle changes the row's numbers. Works on DrawRows (not WireOps) so edits land in the
// editor; a row whose coordinates use {variables} can't be dragged (there's no number to change).

import type { DrawRow } from "./ops";

// A grip, in continuous screen coordinates: (0,0) is the top-left corner of the screen and
// (320,240) the bottom-right, so a box's edge sits at x and x + w and a pixel's centre at x + 0.5.
export interface Handle {
  id: string;
  x: number;
  y: number;
  cursor: string;
}

/** The resize cursor for a compass handle id (n, ne, e, ...); "move" for point grips. */
export function cursorFor(handle: string): string {
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "nw" || handle === "se") return "nwse-resize";
  if (handle === "ne" || handle === "sw") return "nesw-resize";
  return "move";
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

const grip = (id: string, x: number, y: number): Handle => ({ id, x, y, cursor: cursorFor(id) });

// The box a rectangle or circle row covers, in screen pixels (matches opBounds).
function resizeBox(row: DrawRow, n: Record<string, number>) {
  if (RECTS.has(row.op)) return { x: n.x, y: n.y, w: n.w, h: n.h };
  if (CIRCLES.has(row.op)) return { x: n.x - n.r, y: n.y - n.r, w: 2 * n.r + 1, h: 2 * n.r + 1 };
  return null;
}

export function handlesFor(row: DrawRow): Handle[] {
  const n = numbers(row);
  if (!n) return [];
  if (RECTS.has(row.op)) {
    const l = n.x, t = n.y, r = n.x + n.w, b = n.y + n.h, cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    return [
      grip("nw", l, t), grip("n", cx, t), grip("ne", r, t), grip("e", r, cy),
      grip("se", r, b), grip("s", cx, b), grip("sw", l, b), grip("w", l, cy),
    ];
  }
  if (CIRCLES.has(row.op)) {
    const c = { x: n.x + 0.5, y: n.y + 0.5 };
    return [grip("n", c.x, n.y - n.r), grip("e", n.x + n.r + 1, c.y), grip("s", c.x, n.y + n.r + 1), grip("w", n.x - n.r, c.y)];
  }
  if (row.op === "drawFastHLine") return [grip("w", n.x, n.y + 0.5), grip("e", n.x + n.w, n.y + 0.5)];
  if (row.op === "drawFastVLine") return [grip("n", n.x + 0.5, n.y), grip("s", n.x + 0.5, n.y + n.h)];
  if (row.op === "drawLine" || row.op === "drawTriangle" || row.op === "fillTriangle") {
    const count = row.op === "drawLine" ? 2 : 3;
    return Array.from({ length: count }, (_, i) => grip(`p${i}`, n[`x${i}`] + 0.5, n[`y${i}`] + 0.5));
  }
  return [];
}

// Which resize a press at (px, py) (continuous screen coordinates) starts when it lands near the
// edge or corner of a selected rectangle or circle: a compass id for applyDrag, or null. `tol` is
// how far from the edge counts, in screen pixels; inside the shape the band shrinks to a quarter
// of its size so a small shape's middle still moves it.
export function edgeHandleAt(row: DrawRow, px: number, py: number, tol: number): string | null {
  const n = numbers(row);
  if (!n) return null;
  const box = resizeBox(row, n);
  if (!box || box.w <= 0 || box.h <= 0) return null;
  const l = box.x, t = box.y, r = box.x + box.w, b = box.y + box.h;
  if (px < l - tol || px > r + tol || py < t - tol || py > b + tol) return null;
  const inX = Math.min(tol, box.w / 4), inY = Math.min(tol, box.h / 4);
  const nearW = px <= l + inX, nearE = px >= r - inX, nearN = py <= t + inY, nearS = py >= b - inY;
  const v = nearN ? "n" : nearS ? "s" : "";
  const h = nearW ? "w" : nearE ? "e" : "";
  if (!v && !h) return null;
  if (RECTS.has(row.op)) return v + h;
  // Circles only resize from their four sides; in a corner, take the nearer side.
  if (v && h) {
    const dv = nearN ? Math.abs(py - t) : Math.abs(py - b);
    const dh = nearW ? Math.abs(px - l) : Math.abs(px - r);
    return dv <= dh ? v : h;
  }
  return v || h;
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
  } else if (start.op === "drawFastHLine" && (handle === "e" || handle === "w")) {
    if (handle === "e") set.w = Math.max(1, n.w + dx);
    else {
      set.x = Math.min(n.x + dx, n.x + n.w - 1);
      set.w = n.x + n.w - set.x;
    }
  } else if (start.op === "drawFastVLine" && (handle === "s" || handle === "n")) {
    if (handle === "s") set.h = Math.max(1, n.h + dy);
    else {
      set.y = Math.min(n.y + dy, n.y + n.h - 1);
      set.h = n.y + n.h - set.y;
    }
  } else if (CIRCLES.has(start.op) && ["n", "e", "s", "w"].includes(handle)) {
    // Outward is bigger on every side.
    const grow = handle === "e" ? dx : handle === "w" ? -dx : handle === "s" ? dy : -dy;
    set.r = Math.max(0, n.r + grow);
  } else if (/^p\d$/.test(handle)) {
    const i = handle[1];
    set[`x${i}`] = n[`x${i}`] + dx;
    set[`y${i}`] = n[`y${i}`] + dy;
  }

  return { ...start, args: { ...start.args, ...set } };
}
