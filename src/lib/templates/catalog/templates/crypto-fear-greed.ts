import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Crypto Fear & Greed Index: a semicircle gauge of coloured segments with a needle,
// today's value and classification, and yesterday / last week / last month underneath.

// Gauge geometry. Data and Draw both use these numbers.
const CX = 160;
const CY = 140;
const R_OUT = 106;
const R_IN = 78;
const SEGS = 20; // coloured segments across 0-100
const SUB = 3; // quads per segment, so the arc looks round
const GAP = 1.2; // degrees left dark between segments

// Colour stops from Extreme Fear (red) to Extreme Greed (green).
const STOPS: [number, number, number, number][] = [
  [0, 0xe0, 0x30, 0x30],
  [25, 0xf0, 0x78, 0x20],
  [50, 0xf0, 0xd0, 0x20],
  [75, 0x90, 0xd0, 0x30],
  [100, 0x20, 0xb0, 0x50],
];

function colorAt(v: number): string {
  let i = 0;
  while (i < STOPS.length - 2 && v > STOPS[i + 1][0]) i++;
  const [a, b] = [STOPS[i], STOPS[i + 1]];
  const t = (v - a[0]) / (b[0] - a[0]);
  const h = (k: number) => Math.round(a[k] + (b[k] - a[k]) * t).toString(16).padStart(2, "0");
  return ("#" + h(1) + h(2) + h(3)).toUpperCase();
}

function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.round(CX + r * Math.cos(a)), Math.round(CY - r * Math.sin(a))];
}

// Each segment is SUB quads (two triangles each) between the inner and outer radius.
const gauge: RawWireOp[] = [];
for (let s = 0; s < SEGS; s++) {
  const color = colorAt(((s + 0.5) * 100) / SEGS);
  const a0 = 180 - (s * 180) / SEGS - GAP / 2;
  const a1 = 180 - ((s + 1) * 180) / SEGS + GAP / 2;
  for (let k = 0; k < SUB; k++) {
    const d0 = a0 + ((a1 - a0) * k) / SUB;
    const d1 = a0 + ((a1 - a0) * (k + 1)) / SUB;
    const [o0x, o0y] = pt(R_OUT, d0);
    const [o1x, o1y] = pt(R_OUT, d1);
    const [i0x, i0y] = pt(R_IN, d0);
    const [i1x, i1y] = pt(R_IN, d1);
    gauge.push(["fillTriangle", o0x, o0y, o1x, o1y, i0x, i0y, color]);
    gauge.push(["fillTriangle", o1x, o1y, i1x, i1y, i0x, i0y, color]);
  }
}

const code = String.raw`// Crypto Fear & Greed Index from alternative.me (free, no key). Updates once a day.
const CX = ${CX}, CY = ${CY}; // gauge centre, keep in step with Draw
const N_IN = ${R_IN - 6}, N_OUT = ${R_OUT + 6}; // needle runs across the ring
const N_HALF = 5; // half-width of the needle base, px

const STOPS = ${JSON.stringify(STOPS)};
function colorAt(v) {
  let i = 0;
  while (i < STOPS.length - 2 && v > STOPS[i + 1][0]) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  const t = (v - a[0]) / (b[0] - a[0]);
  const h = (k) => { const s = Math.round(a[k] + (b[k] - a[k]) * t).toString(16); return s.length < 2 ? "0" + s : s; };
  return ("#" + h(1) + h(2) + h(3)).toUpperCase();
}

let rows = [];
try {
  const r = await get("https://api.alternative.me/fng/?limit=31", { cache: 3600 });
  rows = (r && r.data) || [];
} catch (err) {
  console.log("fng failed:", err.message);
}

function at(i) {
  const d = rows[i];
  const v = d ? Number(d.value) : NaN;
  if (!isFinite(v)) return { v: NaN, text: "--", cls: "", color: "#808080" };
  return { v: v, text: String(v), cls: String(d.value_classification || ""), color: colorAt(v) };
}

const today = at(0);
export const value = today.text;
export const label = isFinite(today.v) ? today.cls : "No data";
export const color = today.color;

// Needle: angle 180 deg at 0, 0 deg at 100. Hidden off-screen when there is no data.
const deg = isFinite(today.v) ? 180 - Math.max(0, Math.min(100, today.v)) * 1.8 : 90;
const rad = (deg * Math.PI) / 180;
const c = Math.cos(rad), s = Math.sin(rad);
const off = isFinite(today.v) ? 0 : -400;
export const n_x0 = Math.round(CX + N_IN * c), n_y0 = Math.round(CY - N_IN * s) + off;
export const n_x1 = Math.round(CX + N_OUT * c), n_y1 = Math.round(CY - N_OUT * s) + off;
export const n_ax = Math.round(CX + N_IN * c - N_HALF * s), n_ay = Math.round(CY - N_IN * s - N_HALF * c) + off;
export const n_bx = Math.round(CX + N_IN * c + N_HALF * s), n_by = Math.round(CY - N_IN * s + N_HALF * c) + off;

const y = at(1), w = at(7), m = at(30);
export const y_val = y.text, y_cls = y.cls, y_col = y.color;
export const w_val = w.text, w_cls = w.cls, w_col = w.color;
export const m_val = m.text, m_cls = m.cls, m_col = m.color;

export const clock = now("HH:mm");
`;

const BG = "#000000";
const HEAD = "#1A1A24";
const LABEL = "#8A8A9A";
const LINE = "#2A2A38";

const history = (x: number, title: string, k: string): RawWireOp[] => [
  ["text", title, x, 188, 1, 1, "TC", LABEL],
  ["text", `{${k}_val}`, x, 199, 4, 1, "TC", `{${k}_col}`],
  ["text", `{${k}_cls}`, x, 228, 1, 1, "TC", LABEL],
];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "CRYPTO FEAR & GREED", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C8C8D4"],
  // Gauge
  ...gauge,
  ["text", "0", CX - (R_OUT + R_IN) / 2, CY + 4, 1, 1, "TC", LABEL],
  ["text", "100", CX + (R_OUT + R_IN) / 2, CY + 4, 1, 1, "TC", LABEL],
  // Needle
  ["fillTriangle", "{n_ax}", "{n_ay}", "{n_bx}", "{n_by}", "{n_x1}", "{n_y1}", "#FFFFFF"],
  ["drawLine", "{n_x0}", "{n_y0}", "{n_x1}", "{n_y1}", "#FFFFFF"],
  // Value and classification
  ["text", "{value}", CX, CY + 6, 4, 2, "BC", "{color}"],
  ["text", "{label}", CX, CY + 13, 4, 1, "TC", "{color}"],
  // History
  ["drawFastHLine", 8, 182, 304, LINE],
  ...history(56, "YESTERDAY", "y"),
  ...history(160, "LAST WEEK", "w"),
  ...history(264, "LAST MONTH", "m"),
];

const template: Template = {
  id: "crypto-fear-greed",
  name: "Crypto Fear & Greed",
  description: "The Crypto Fear & Greed Index on a red-to-green gauge with a needle, plus yesterday, last week and last month.",
  apis: ["alternative.me"],
  category: "finance",
  dataCode: code,
  rows: rows("crypto-fear-greed", wire),
  sampleVars: {"clock":"01:09","color":"#E85328","label":"Extreme Fear","m_cls":"Greed","m_col":"#BED028","m_val":"63","n_ax":91,"n_ay":118,"n_bx":95,"n_by":109,"n_x0":93,"n_x1":56,"n_y0":113,"n_y1":99,"value":"12","w_cls":"Extreme Fear","w_col":"#ED6A23","w_val":"20","y_cls":"Extreme Fear","y_col":"#E64D2A","y_val":"10"},
};

export default template;
