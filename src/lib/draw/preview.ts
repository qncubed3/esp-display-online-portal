// Browser emulation of TFT_eSPI for the Draw preview.
// Plays WireOps on a 320×240 canvas with integer-pixel rasterisation
// (the same midpoint/Bresenham algorithms the library uses) so the preview
// looks like the device: no anti-aliasing, colours quantised to RGB565.

import { FONT2, FONT4, GLCD } from "./fonts";
import { SCREEN_HEIGHT, SCREEN_WIDTH, type WireOp } from "./ops";
import { TEXT_ROT_OP, normalizeAngle } from "./rotate";

type Datum = "TL" | "TC" | "TR" | "ML" | "MC" | "MR" | "BL" | "BC" | "BR";

interface TextState {
  fg: string;
  bg: string | null; // null = transparent background
  size: number;
  datum: Datum;
}

// Text uses TFT_eSPI's own bitmap fonts (see fonts.ts), so it matches the device pixel for pixel.
const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
let glcdBytes: Uint8Array | null = null;
const glyphCache = new Map<string, Uint8Array>();

const fontHeight = (fontId: number) => (fontId === 2 ? FONT2.height : fontId === 4 ? FONT4.height : 8);

// Characters a font can draw, as codes. Font 1 covers 0–255; fonts 2 and 4 only 32–127 (others are skipped).
function codes(str: string, fontId: number): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (fontId === 2 || fontId === 4 ? c >= 32 && c < 128 : c < 256) out.push(c);
  }
  return out;
}

// Width in pixels at text size 1, like TFT_eSPI's textWidth().
function textWidth(str: string, fontId: number): number {
  if (fontId !== 2 && fontId !== 4) return codes(str, 1).length * 6;
  const widths = fontId === 2 ? FONT2.widths : FONT4.widths;
  return codes(str, fontId).reduce((w, c) => w + widths[c - 32], 0);
}

// Calls ink(x, y) for every lit pixel of the string at size 1, relative to its top-left corner.
function eachInkPixel(str: string, fontId: number, ink: (x: number, y: number) => void) {
  let left = 0;
  if (fontId !== 2 && fontId !== 4) {
    glcdBytes ??= decode(GLCD);
    for (const c of codes(str, 1)) {
      for (let col = 0; col < 5; col++) {
        const bits = glcdBytes[c * 5 + col];
        for (let row = 0; row < 8; row++) if (bits & (1 << row)) ink(left + col, row);
      }
      left += 6;
    }
    return;
  }
  const font = fontId === 2 ? FONT2 : FONT4;
  for (const c of codes(str, fontId)) {
    const w = font.widths[c - 32];
    const key = `${fontId}:${c}`;
    let data = glyphCache.get(key);
    if (!data) glyphCache.set(key, (data = decode(font.glyphs[c - 32])));
    if (fontId === 2) {
      const perRow = Math.floor((w + 6) / 8);
      for (let row = 0; row < font.height; row++)
        for (let bit = 0; bit < perRow * 8; bit++)
          if (data[row * perRow + (bit >> 3)] & (0x80 >> (bit & 7))) ink(left + bit, row);
    } else {
      // Run-length encoded, row-major over w × height: (b & 0x7f) + 1 pixels, ink when b & 0x80.
      let p = 0;
      for (const b of data) {
        const n = (b & 0x7f) + 1;
        if (b & 0x80) for (let i = 0; i < n; i++) ink(left + ((p + i) % w), Math.floor((p + i) / w));
        p += n;
      }
    }
    left += w;
  }
}

const DATUMS: Datum[] = ["TL", "TC", "TR", "ML", "MC", "MR", "BL", "BC", "BR"];

// Parse "#RRGGBB" / "#RGB" (or a number in RGB565) and quantise to RGB565 like the panel does.
export function toPanelColor(value: unknown): string | null {
  let r: number, g: number, b: number;
  if (typeof value === "number" && Number.isFinite(value)) {
    const c = value & 0xffff;
    r = ((c >> 11) & 0x1f) << 3;
    g = ((c >> 5) & 0x3f) << 2;
    b = (c & 0x1f) << 3;
  } else if (typeof value === "string") {
    const s = value.trim();
    let m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (m) {
      const n = parseInt(m[1], 16);
      r = (n >> 16) & 0xff;
      g = (n >> 8) & 0xff;
      b = n & 0xff;
    } else if ((m = /^#?([0-9a-f]{3})$/i.exec(s))) {
      r = parseInt(m[1][0] + m[1][0], 16);
      g = parseInt(m[1][1] + m[1][1], 16);
      b = parseInt(m[1][2] + m[1][2], 16);
    } else {
      return null;
    }
  } else {
    return null;
  }
  // RGB565 quantisation, then expand back so white stays white.
  r = (r >> 3) * 255 / 31;
  g = (g >> 2) * 255 / 63;
  b = (b >> 3) * 255 / 31;
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

const int = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

// A string's unrotated box at the current text size and datum, like TFT_eSPI places it.
function textBox(str: string, x: number, y: number, fontId: number, size: number, datum: Datum) {
  const w = textWidth(str, fontId) * size, h = fontHeight(fontId) * size;
  const di = Math.max(0, DATUMS.indexOf(datum));
  const col = di % 3, row = Math.floor(di / 3);
  return { w, h, left: x - (col === 1 ? Math.floor(w / 2) : col === 2 ? w : 0), top: y - (row === 1 ? Math.floor(h / 2) : row === 2 ? h : 0) };
}

// Rotated text, like the firmware's sprite pushRotated: the text's box turns `deg` clockwise about
// its centre; each screen pixel takes the nearest source pixel (no anti-aliasing). `plot(x, y, ink)`
// is called for every covered pixel (ink false = background).
function eachRotatedPixel(
  w: number, h: number, left: number, top: number, deg: number,
  inkAt: (sx: number, sy: number) => boolean,
  plot: (x: number, y: number, ink: boolean) => void,
) {
  const px = Math.floor(w / 2), py = Math.floor(h / 2); // pivot inside the box, as on the device
  const cx = left + px, cy = top + py;
  const rad = (deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  const corners = [[-px, -py], [w - px, -py], [w - px, h - py], [-px, h - py]].map(([dx, dy]) => [dx * c - dy * s, dx * s + dy * c]);
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  for (let dy = Math.floor(Math.min(...ys)); dy <= Math.ceil(Math.max(...ys)); dy++) {
    for (let dx = Math.floor(Math.min(...xs)); dx <= Math.ceil(Math.max(...xs)); dx++) {
      // Inverse rotation of the pixel centre back into the text box.
      const sx = Math.floor((dx + 0.5) * c + (dy + 0.5) * s) + px;
      const sy = Math.floor(-(dx + 0.5) * s + (dy + 0.5) * c) + py;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      plot(cx + dx, cy + dy, inkAt(sx, sy));
    }
  }
}

// Screen box covered by text turned `deg` about its centre.
function rotatedTextBounds(w: number, h: number, left: number, top: number, deg: number): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  eachRotatedPixel(w, h, left, top, deg, () => true, (x, y) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  });
  return minX === Infinity ? { x: left, y: top, w, h } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}


export function renderPreview(ctx: CanvasRenderingContext2D, ops: WireOp[]): void {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  // The panel's RAM is undefined at power-up; start from black.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const text: TextState = { fg: toPanelColor("#FFFFFF")!, bg: null, size: 1, datum: "TL" };
  let color = "#fff";

  const setColor = (c: unknown): boolean => {
    const p = toPanelColor(c);
    if (!p) return false;
    color = p;
    ctx.fillStyle = p;
    return true;
  };
  const px = (x: number, y: number) => ctx.fillRect(x, y, 1, 1);
  const hline = (x: number, y: number, w: number) => {
    if (w > 0) ctx.fillRect(x, y, w, 1);
  };
  const vline = (x: number, y: number, h: number) => {
    if (h > 0) ctx.fillRect(x, y, 1, h);
  };
  const rect = (x: number, y: number, w: number, h: number) => {
    if (w > 0 && h > 0) ctx.fillRect(x, y, w, h);
  };

  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      px(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  const circleHelper = (x0: number, y0: number, r: number, corners: number) => {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; }
      x++; ddx += 2; f += ddx;
      if (corners & 4) { px(x0 + x, y0 + y); px(x0 + y, y0 + x); }
      if (corners & 2) { px(x0 + x, y0 - y); px(x0 + y, y0 - x); }
      if (corners & 8) { px(x0 - y, y0 + x); px(x0 - x, y0 + y); }
      if (corners & 1) { px(x0 - y, y0 - x); px(x0 - x, y0 - y); }
    }
  };

  const fillCircleHelper = (x0: number, y0: number, r: number, corners: number, delta: number) => {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r, pxx = x, py = y;
    delta++;
    while (x < y) {
      if (f >= 0) { y--; ddy += 2; f += ddy; }
      x++; ddx += 2; f += ddx;
      if (x < y + 1) {
        if (corners & 1) vline(x0 + x, y0 - y, 2 * y + delta);
        if (corners & 2) vline(x0 - x, y0 - y, 2 * y + delta);
      }
      if (y !== py) {
        if (corners & 1) vline(x0 + py, y0 - pxx, 2 * pxx + delta);
        if (corners & 2) vline(x0 - py, y0 - pxx, 2 * pxx + delta);
        py = y;
      }
      pxx = x;
    }
  };

  const fillTriangle = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    // Sort by y.
    if (y0 > y1) [y0, y1, x0, x1] = [y1, y0, x1, x0];
    if (y1 > y2) [y1, y2, x1, x2] = [y2, y1, x2, x1];
    if (y0 > y1) [y0, y1, x0, x1] = [y1, y0, x1, x0];
    if (y0 === y2) {
      const a = Math.min(x0, x1, x2), b = Math.max(x0, x1, x2);
      hline(a, y0, b - a + 1);
      return;
    }
    const edge = (xa: number, ya: number, xb: number, yb: number, y: number) =>
      yb === ya ? xa : xa + Math.trunc(((xb - xa) * (y - ya)) / (yb - ya));
    for (let y = y0; y <= y2; y++) {
      const a = edge(x0, y0, x2, y2, y);
      const b = y < y1 ? edge(x0, y0, x1, y1, y) : edge(x1, y1, x2, y2, y);
      hline(Math.min(a, b), y, Math.abs(b - a) + 1);
    }
  };

  const drawString = (str: string, x: number, y: number, fontId: number) => {
    if (!str) return;
    const size = Math.max(1, text.size);
    const { w, h, left, top } = textBox(str, x, y, fontId, size, text.datum);
    if (w <= 0) return;

    if (text.bg) {
      ctx.fillStyle = text.bg;
      ctx.fillRect(left, top, w, h);
    }
    ctx.fillStyle = text.fg;
    eachInkPixel(str, fontId, (px, py) => ctx.fillRect(left + px * size, top + py * size, size, size));
    ctx.fillStyle = color;
  };

  const drawStringRot = (str: string, x: number, y: number, fontId: number, deg: number) => {
    if (deg === 0) return drawString(str, x, y, fontId);
    if (!str) return;
    const size = Math.max(1, text.size);
    const { w, h, left, top } = textBox(str, x, y, fontId, size, text.datum);
    if (w <= 0) return;
    const mask = new Uint8Array(w * h);
    eachInkPixel(str, fontId, (px, py) => {
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) mask[(py * size + j) * w + px * size + i] = 1;
    });
    eachRotatedPixel(w, h, left, top, deg, (sx, sy) => mask[sy * w + sx] === 1, (px, py, ink) => {
      if (!ink && !text.bg) return;
      ctx.fillStyle = ink ? text.fg : text.bg!;
      ctx.fillRect(px, py, 1, 1);
    });
    ctx.fillStyle = color;
  };

  for (const op of ops) {
    if (!Array.isArray(op) || typeof op[0] !== "string") continue;
    const [name, ...a] = op;
    switch (name) {
      case "fillScreen":
        if (setColor(a[0])) rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        break;
      case "drawPixel":
        if (setColor(a[2])) px(int(a[0]), int(a[1]));
        break;
      case "drawLine":
        if (setColor(a[4])) line(int(a[0]), int(a[1]), int(a[2]), int(a[3]));
        break;
      case "drawFastHLine":
        if (setColor(a[3])) hline(int(a[0]), int(a[1]), int(a[2]));
        break;
      case "drawFastVLine":
        if (setColor(a[3])) vline(int(a[0]), int(a[1]), int(a[2]));
        break;
      case "drawRect": {
        if (!setColor(a[4])) break;
        const [x, y, w, h] = [int(a[0]), int(a[1]), int(a[2]), int(a[3])];
        if (w <= 0 || h <= 0) break;
        hline(x, y, w); hline(x, y + h - 1, w);
        vline(x, y, h); vline(x + w - 1, y, h);
        break;
      }
      case "fillRect":
        if (setColor(a[4])) rect(int(a[0]), int(a[1]), int(a[2]), int(a[3]));
        break;
      case "drawRoundRect": {
        if (!setColor(a[5])) break;
        const [x, y, w, h] = [int(a[0]), int(a[1]), int(a[2]), int(a[3])];
        if (w <= 0 || h <= 0) break;
        const r = Math.max(0, Math.min(int(a[4]), Math.floor(Math.min(w, h) / 2)));
        hline(x + r, y, w - 2 * r); hline(x + r, y + h - 1, w - 2 * r);
        vline(x, y + r, h - 2 * r); vline(x + w - 1, y + r, h - 2 * r);
        circleHelper(x + r, y + r, r, 1);
        circleHelper(x + w - r - 1, y + r, r, 2);
        circleHelper(x + w - r - 1, y + h - r - 1, r, 4);
        circleHelper(x + r, y + h - r - 1, r, 8);
        break;
      }
      case "fillRoundRect": {
        if (!setColor(a[5])) break;
        const [x, y, w, h] = [int(a[0]), int(a[1]), int(a[2]), int(a[3])];
        if (w <= 0 || h <= 0) break;
        const r = Math.max(0, Math.min(int(a[4]), Math.floor(Math.min(w, h) / 2)));
        rect(x + r, y, w - 2 * r, h);
        fillCircleHelper(x + w - r - 1, y + r, r, 1, h - 2 * r - 1);
        fillCircleHelper(x + r, y + r, r, 2, h - 2 * r - 1);
        break;
      }
      case "drawCircle": {
        if (!setColor(a[3])) break;
        const [x0, y0, r] = [int(a[0]), int(a[1]), int(a[2])];
        if (r < 0) break;
        px(x0, y0 + r); px(x0, y0 - r); px(x0 + r, y0); px(x0 - r, y0);
        circleHelper(x0, y0, r, 15);
        break;
      }
      case "fillCircle": {
        if (!setColor(a[3])) break;
        const [x0, y0, r] = [int(a[0]), int(a[1]), int(a[2])];
        if (r < 0) break;
        vline(x0, y0 - r, 2 * r + 1);
        fillCircleHelper(x0, y0, r, 3, 0);
        break;
      }
      case "drawTriangle": {
        if (!setColor(a[6])) break;
        const p = a.slice(0, 6).map(int);
        line(p[0], p[1], p[2], p[3]);
        line(p[2], p[3], p[4], p[5]);
        line(p[4], p[5], p[0], p[1]);
        break;
      }
      case "fillTriangle": {
        if (!setColor(a[6])) break;
        const p = a.slice(0, 6).map(int);
        fillTriangle(p[0], p[1], p[2], p[3], p[4], p[5]);
        break;
      }
      case "setTextColor": {
        const fg = toPanelColor(a[0]);
        if (!fg) break;
        text.fg = fg;
        const bg = a.length > 1 && a[1] !== "" ? toPanelColor(a[1]) : null;
        // TFT_eSPI: bg == fg means transparent background.
        text.bg = bg && bg !== fg ? bg : null;
        break;
      }
      case "setTextSize":
        text.size = Math.min(7, Math.max(1, int(a[0]) || 1));
        break;
      case "setTextDatum": {
        const v = a[0];
        if (typeof v === "number" && v >= 0 && v < 9) text.datum = DATUMS[v];
        else if (typeof v === "string" && (DATUMS as string[]).includes(v.toUpperCase())) text.datum = v.toUpperCase() as Datum;
        break;
      }
      case "drawString":
        drawString(String(a[0] ?? ""), int(a[1]), int(a[2]), a.length > 3 ? int(a[3]) : 1);
        break;
      case TEXT_ROT_OP:
        drawStringRot(String(a[0] ?? ""), int(a[1]), int(a[2]), a.length > 3 ? int(a[3]) : 1, normalizeAngle(a[4]));
        break;
      default:
        break; // unknown ops are skipped, like the firmware
    }
  }
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The screen area each op covers, in the same coordinates renderPreview draws in; null for ops that
// draw nothing (text state changes, bad values). Used to click shapes on the preview and outline them.
export function opBounds(ops: WireOp[]): (Box | null)[] {
  const text = { size: 1, datum: "TL" as Datum };
  const box = (x: number, y: number, w: number, h: number): Box | null => (w > 0 && h > 0 ? { x, y, w, h } : null);
  const around = (pts: number[]): Box => {
    const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
  };

  return ops.map((op): Box | null => {
    if (!Array.isArray(op) || typeof op[0] !== "string") return null;
    const [name, ...a] = op;
    switch (name) {
      case "fillScreen":
        return box(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      case "drawPixel":
        return box(int(a[0]), int(a[1]), 1, 1);
      case "drawLine":
        return around(a.slice(0, 4).map(int));
      case "drawFastHLine":
        return box(int(a[0]), int(a[1]), int(a[2]), 1);
      case "drawFastVLine":
        return box(int(a[0]), int(a[1]), 1, int(a[2]));
      case "drawRect":
      case "fillRect":
      case "drawRoundRect":
      case "fillRoundRect":
        return box(int(a[0]), int(a[1]), int(a[2]), int(a[3]));
      case "drawCircle":
      case "fillCircle": {
        const r = int(a[2]);
        return r < 0 ? null : box(int(a[0]) - r, int(a[1]) - r, 2 * r + 1, 2 * r + 1);
      }
      case "drawTriangle":
      case "fillTriangle":
        return around(a.slice(0, 6).map(int));
      case "setTextSize":
        text.size = Math.min(7, Math.max(1, int(a[0]) || 1));
        return null;
      case "setTextDatum": {
        const v = a[0];
        if (typeof v === "number" && v >= 0 && v < 9) text.datum = DATUMS[v];
        else if (typeof v === "string" && (DATUMS as string[]).includes(v.toUpperCase())) text.datum = v.toUpperCase() as Datum;
        return null;
      }
      case "drawString":
      case TEXT_ROT_OP: {
        const str = String(a[0] ?? "");
        const fontId = a.length > 3 ? int(a[3]) : 1;
        const { w, h, left, top } = textBox(str, int(a[1]), int(a[2]), fontId, text.size, text.datum);
        const deg = name === TEXT_ROT_OP ? normalizeAngle(a[4]) : 0;
        if (deg && w > 0 && h > 0) return rotatedTextBounds(w, h, left, top, deg);
        return box(left, top, w, h);
      }
      default:
        return null;
    }
  });
}
