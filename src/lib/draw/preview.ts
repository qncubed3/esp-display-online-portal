// Browser emulation of TFT_eSPI for the Draw preview.
// Plays WireOps on a 320×240 canvas with integer-pixel rasterisation
// (the same midpoint/Bresenham algorithms the library uses) so the preview
// looks like the device: no anti-aliasing, colours quantised to RGB565.

import { SCREEN_HEIGHT, SCREEN_WIDTH, type WireOp } from "./ops";

type Datum = "TL" | "TC" | "TR" | "ML" | "MC" | "MR" | "BL" | "BC" | "BR";

interface TextState {
  fg: string;
  bg: string | null; // null = transparent background
  size: number;
  datum: Datum;
}

// Font metrics at size 1. Font 1 is the 6×8 GLCD cell; 2 and 4 approximate the
// proportional fonts' heights (16px and 26px).
const FONTS: Record<number, { height: number; css: string; mono?: number; baselineOffset: number }> = {
  1: { height: 8, css: '8px "Courier New", Courier, monospace', mono: 6, baselineOffset: 0 },
  2: { height: 16, css: "bold 13px Arial, Helvetica, sans-serif", baselineOffset: 2 },
  4: { height: 26, css: "bold 22px Arial, Helvetica, sans-serif", baselineOffset: 2 },
};

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

let scratch: HTMLCanvasElement | null = null;
function getScratch(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!scratch) scratch = document.createElement("canvas");
  return scratch.getContext("2d", { willReadFrequently: true });
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
    const font = FONTS[fontId] ?? FONTS[1];
    const s = getScratch();
    if (!s || !str) return;
    const size = Math.max(1, text.size);

    // Measure at size 1.
    s.font = font.css;
    let w1: number;
    if (font.mono) w1 = str.length * font.mono;
    else w1 = Math.max(1, Math.ceil(s.measureText(str).width) + 1);
    const h1 = font.height;

    // Render at size 1 into the scratch canvas, then threshold alpha for hard pixels.
    const canvas = s.canvas;
    if (canvas.width < w1 || canvas.height < h1) {
      canvas.width = Math.max(canvas.width, w1);
      canvas.height = Math.max(canvas.height, h1);
    }
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, canvas.width, canvas.height);
    s.font = font.css;
    s.textBaseline = "top";
    s.textAlign = "left";
    s.fillStyle = text.fg;
    if (font.mono) {
      for (let i = 0; i < str.length; i++) s.fillText(str[i], i * font.mono, font.baselineOffset, font.mono);
    } else {
      s.fillText(str, 0, font.baselineOffset);
    }
    const img = s.getImageData(0, 0, w1, h1);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 96 ? 255 : 0;
    s.putImageData(img, 0, 0);

    // Datum → top-left.
    const w = w1 * size, h = h1 * size;
    const di = Math.max(0, DATUMS.indexOf(text.datum));
    const col = di % 3, row = Math.floor(di / 3);
    const left = x - (col === 1 ? Math.floor(w / 2) : col === 2 ? w : 0);
    const top = y - (row === 1 ? Math.floor(h / 2) : row === 2 ? h : 0);

    if (text.bg) {
      ctx.fillStyle = text.bg;
      ctx.fillRect(left, top, w, h);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, w1, h1, left, top, w, h);
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
      default:
        break; // unknown ops are skipped, like the firmware
    }
  }
}
