// Per-item rotation for Draw rows (the optional trailing "angle" arg, in degrees clockwise).
//
// Shapes are turned into ops every firmware already draws, here on the server (toWireOps), so the
// editor preview, v1 frames and v2 frames all show the same pixels:
// - Every shape turns about the centre of the box its pixels cover (a line: its midpoint).
// - Rectangles and rounded rectangles at 90/180/270 stay the same op, with width and height swapped
//   for 90/270 (exact). At other angles a filled rectangle becomes two fillTriangle and an outline
//   four drawLine; rounded rectangles become a polygon (each corner arc approximated by a few
//   straight segments): a fan of fillTriangle, or drawLine around the outline.
// - Lines and triangles keep their op with rotated end points.
// Text can't be built from other ops, so a rotated drawString becomes "drawStringRot" (frame v2
// only, see src/lib/draw/frame.ts): the text turns about the centre of its unrotated box.

import type { WireOp } from "./ops";

/** Device op for rotated text: drawString's args plus the angle. Frame v2 and firmware v2+. */
export const TEXT_ROT_OP = "drawStringRot";

/** Degrees as a whole number in 0..359 (anything unreadable is 0). */
export function normalizeAngle(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? ((n % 360) + 360) % 360 : 0;
}

type Pt = [number, number];

const int = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// Turns points about (cx, cy) by `deg` clockwise (screen y points down), rounded to pixels.
function turn(pts: Pt[], cx: number, cy: number, deg: number): Pt[] {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  return pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    return [Math.round(cx + dx * c - dy * s) || 0, Math.round(cy + dx * s + dy * c) || 0]; // no -0
  });
}

// Pixel-centre coordinates, so the box of x..x+w-1 turns about its middle pixel.
const centreOf = (pts: Pt[]): Pt => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

function polygon(pts: Pt[], filled: boolean, color: string | number, centre: Pt): WireOp[] {
  const out: WireOp[] = [];
  const [cx, cy] = [Math.round(centre[0]), Math.round(centre[1])];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (filled) out.push(["fillTriangle", cx, cy, a[0], a[1], b[0], b[1], color]);
    else out.push(["drawLine", a[0], a[1], b[0], b[1], color]);
  }
  return out;
}

// Same rectangle op turned by a multiple of 90 degrees.
function quarterTurn(op: WireOp, deg: number): WireOp {
  const [name, x, y, w, h, ...rest] = op as [string, number, number, number, number, ...(string | number)[]];
  if (deg === 180) return op;
  const cx = x + (w - 1) / 2, cy = y + (h - 1) / 2;
  return [name, Math.round(cx - (h - 1) / 2), Math.round(cy - (w - 1) / 2), h, w, ...rest];
}

// Corner arcs of a rounded rectangle, clockwise from the top-left, as pixel points.
function roundRectOutline(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const steps = Math.min(8, Math.max(2, Math.ceil(r / 3)));
  const corners: [number, number, number][] = [
    [x + r, y + r, 180], [x + w - 1 - r, y + r, 270], [x + w - 1 - r, y + h - 1 - r, 0], [x + r, y + h - 1 - r, 90],
  ];
  const pts: Pt[] = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = ((start + (90 * i) / steps) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

/** One device op turned by `deg` (0..359) clockwise: the ops that draw it. Non-shape ops pass through. */
export function rotateOp(op: WireOp, deg: number): WireOp[] {
  if (deg === 0) return [op];
  const [name, ...a] = op;
  switch (name) {
    case "drawRect":
    case "fillRect": {
      const [x, y, w, h] = a.slice(0, 4).map(int);
      if (w <= 0 || h <= 0) return [op];
      if (deg % 90 === 0) return [quarterTurn([name, x, y, w, h, a[4]], deg)];
      const box: Pt[] = [[x, y], [x + w - 1, y], [x + w - 1, y + h - 1], [x, y + h - 1]];
      const c = centreOf(box);
      const p = turn(box, c[0], c[1], deg);
      if (name === "drawRect") return polygon(p, false, a[4], c);
      return [
        ["fillTriangle", p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], a[4]],
        ["fillTriangle", p[0][0], p[0][1], p[2][0], p[2][1], p[3][0], p[3][1], a[4]],
      ];
    }
    case "drawRoundRect":
    case "fillRoundRect": {
      const [x, y, w, h, r0] = a.slice(0, 5).map(int);
      if (w <= 0 || h <= 0) return [op];
      if (deg % 90 === 0) return [quarterTurn([name, x, y, w, h, r0, a[5]], deg)];
      const r = Math.max(0, Math.min(r0, Math.floor(Math.min(w, h) / 2)));
      const outline = roundRectOutline(x, y, w, h, r);
      const c = centreOf([[x, y], [x + w - 1, y + h - 1]]);
      return polygon(turn(outline, c[0], c[1], deg), name === "fillRoundRect", a[5], c);
    }
    case "drawLine": {
      const pts: Pt[] = [[int(a[0]), int(a[1])], [int(a[2]), int(a[3])]];
      const c = centreOf(pts);
      const [p0, p1] = turn(pts, c[0], c[1], deg);
      return [[name, p0[0], p0[1], p1[0], p1[1], a[4]]];
    }
    case "drawTriangle":
    case "fillTriangle": {
      const pts: Pt[] = [[int(a[0]), int(a[1])], [int(a[2]), int(a[3])], [int(a[4]), int(a[5])]];
      const c = centreOf(pts);
      const p = turn(pts, c[0], c[1], deg);
      return [[name, p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], a[6]]];
    }
    case "drawString":
      return [[TEXT_ROT_OP, a[0] ?? "", a[1] ?? 0, a[2] ?? 0, a[3] ?? 1, deg]];
    default:
      return [op];
  }
}

/** Ops a v1 device (firmware v1) can draw: rotated text drawn unrotated. Other ops are already v1 ops. */
export function toV1Ops(ops: WireOp[]): WireOp[] {
  return ops.map((op) => (op[0] === TEXT_ROT_OP ? (["drawString", ...op.slice(1, 5)] as WireOp) : op));
}
