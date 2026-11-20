import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// AUD/USD line chart over the last 30 days

const SEG = 24; // line segments in the chart (keep in step with Data)
const CX0 = 52, CX1 = 310, CY0 = 100, CY1 = 206; // chart box

const code = String.raw`// AUD/USD over the last 30 days as a line chart, with the latest rate and the 30-day change.
// Frankfurter v2 (free, no key) with the ECB reference rates, published once per working day.
const BASE = "AUD";
const QUOTE = "USD";
const DAYS_BACK = 30;
const SEG = 24; // line segments drawn (keep in step with the Draw rows)
const X0 = 52, X1 = 310, Y0 = 100, Y1 = 206; // chart box (keep in step with Draw)
const HIDE = -200;
const UP = "#3ECF8E", DOWN = "#FF5A5F", FLAT = "#A0A0A0";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const t = now("YYYY-MM-DD").split("-").map(Number);
const from = new Date(Date.UTC(t[0], t[1] - 1, t[2] - DAYS_BACK)).toISOString().slice(0, 10);

let pts = []; // [{ date, rate }] oldest first
try {
  const data = await get(
    "https://api.frankfurter.dev/v2/rates?providers=ECB&base=" + BASE + "&quotes=" + QUOTE + "&from=" + from,
    { cache: 21600 },
  );
  for (const r of data) if (r.quote === QUOTE && typeof r.rate === "number") pts.push({ date: r.date, rate: r.rate });
  pts.sort((a, b) => (a.date < b.date ? -1 : 1));
} catch (e) {
  console.log("audusd: " + e.message);
}

// Keep at most SEG + 1 points, evenly spaced, always including the first and last.
if (pts.length > SEG + 1) {
  const n = pts.length;
  const keep = [];
  for (let i = 0; i <= SEG; i++) keep.push(pts[Math.round((i * (n - 1)) / SEG)]);
  pts = keep;
}

function fmtDate(s) {
  if (!s) return "";
  const p = s.split("-").map(Number);
  return p[2] + " " + MONTHS[p[1] - 1];
}

const ok = pts.length >= 2;
const rates = pts.map((p) => p.rate);
let lo = ok ? Math.min.apply(null, rates) : 0;
let hi = ok ? Math.max.apply(null, rates) : 1;
if (hi - lo < 1e-6) { hi += 0.0005; lo -= 0.0005; }

const xs = pts.map((p, i) => Math.round(X0 + ((X1 - X0) * i) / (pts.length - 1)));
const ys = pts.map((p) => Math.round(Y1 - ((Y1 - Y0) * (p.rate - lo)) / (hi - lo)));

const first = ok ? pts[0].rate : 0;
const last = pts.length ? pts[pts.length - 1].rate : 0;
const pct = ok ? Math.round((last / first - 1) * 10000) / 100 : 0;
const col = !ok ? FLAT : pct > 0 ? UP : pct < 0 ? DOWN : FLAT;

export const pair = BASE + "/" + QUOTE;
export const rate = pts.length ? last.toFixed(4) : "--";
export const chg = ok ? (pct > 0 ? "+" : "") + pct.toFixed(2) + "%" : "";
export const chg_col = col;
export const chg_label = ok ? "30 days" : "No data";
export const y_max = ok ? hi.toFixed(4) : "";
export const y_min = ok ? lo.toFixed(4) : "";
export const d_start = ok ? fmtDate(pts[0].date) : "";
export const d_end = ok ? fmtDate(pts[pts.length - 1].date) : "";
export const asof = pts.length ? "ECB " + fmtDate(pts[pts.length - 1].date) : "";

// Segment i joins point i to point i + 1; unused segments go off screen.
const seg = [];
for (let i = 0; i < SEG; i++) {
  if (i + 1 < pts.length) seg.push([xs[i], ys[i], xs[i + 1], ys[i + 1]]);
  else seg.push([0, HIDE, 0, HIDE]);
}
export const s0x0 = seg[0][0], s0y0 = seg[0][1], s0x1 = seg[0][2], s0y1 = seg[0][3];
export const s1x0 = seg[1][0], s1y0 = seg[1][1], s1x1 = seg[1][2], s1y1 = seg[1][3];
export const s2x0 = seg[2][0], s2y0 = seg[2][1], s2x1 = seg[2][2], s2y1 = seg[2][3];
export const s3x0 = seg[3][0], s3y0 = seg[3][1], s3x1 = seg[3][2], s3y1 = seg[3][3];
export const s4x0 = seg[4][0], s4y0 = seg[4][1], s4x1 = seg[4][2], s4y1 = seg[4][3];
export const s5x0 = seg[5][0], s5y0 = seg[5][1], s5x1 = seg[5][2], s5y1 = seg[5][3];
export const s6x0 = seg[6][0], s6y0 = seg[6][1], s6x1 = seg[6][2], s6y1 = seg[6][3];
export const s7x0 = seg[7][0], s7y0 = seg[7][1], s7x1 = seg[7][2], s7y1 = seg[7][3];
export const s8x0 = seg[8][0], s8y0 = seg[8][1], s8x1 = seg[8][2], s8y1 = seg[8][3];
export const s9x0 = seg[9][0], s9y0 = seg[9][1], s9x1 = seg[9][2], s9y1 = seg[9][3];
export const s10x0 = seg[10][0], s10y0 = seg[10][1], s10x1 = seg[10][2], s10y1 = seg[10][3];
export const s11x0 = seg[11][0], s11y0 = seg[11][1], s11x1 = seg[11][2], s11y1 = seg[11][3];
export const s12x0 = seg[12][0], s12y0 = seg[12][1], s12x1 = seg[12][2], s12y1 = seg[12][3];
export const s13x0 = seg[13][0], s13y0 = seg[13][1], s13x1 = seg[13][2], s13y1 = seg[13][3];
export const s14x0 = seg[14][0], s14y0 = seg[14][1], s14x1 = seg[14][2], s14y1 = seg[14][3];
export const s15x0 = seg[15][0], s15y0 = seg[15][1], s15x1 = seg[15][2], s15y1 = seg[15][3];
export const s16x0 = seg[16][0], s16y0 = seg[16][1], s16x1 = seg[16][2], s16y1 = seg[16][3];
export const s17x0 = seg[17][0], s17y0 = seg[17][1], s17x1 = seg[17][2], s17y1 = seg[17][3];
export const s18x0 = seg[18][0], s18y0 = seg[18][1], s18x1 = seg[18][2], s18y1 = seg[18][3];
export const s19x0 = seg[19][0], s19y0 = seg[19][1], s19x1 = seg[19][2], s19y1 = seg[19][3];
export const s20x0 = seg[20][0], s20y0 = seg[20][1], s20x1 = seg[20][2], s20y1 = seg[20][3];
export const s21x0 = seg[21][0], s21y0 = seg[21][1], s21x1 = seg[21][2], s21y1 = seg[21][3];
export const s22x0 = seg[22][0], s22y0 = seg[22][1], s22x1 = seg[22][2], s22y1 = seg[22][3];
export const s23x0 = seg[23][0], s23y0 = seg[23][1], s23x1 = seg[23][2], s23y1 = seg[23][3];
`;

const GRID = "#1C2836";
const LINE = "#FFC940";

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#0B2545"],
  ["text", "{pair}", 10, 14, 4, 1, "ML", "#FFC940"],
  ["text", "{asof}", 310, 14, 2, 1, "MR", "#D0DCEB"],
  // Latest rate and the 30-day change
  ["text", "{rate}", 10, 64, 4, 2, "ML", "#FFFFFF"],
  ["text", "{chg}", 310, 56, 4, 1, "MR", "{chg_col}"],
  ["text", "{chg_label}", 310, 80, 2, 1, "MR", "#8A9BB0"],
  // Grid
  ...[0, 1, 2, 3].map((i): RawWireOp => ["drawFastHLine", CX0, CY0 + Math.round(((CY1 - CY0) * i) / 3), CX1 - CX0 + 1, GRID]),
  ...[0, 1, 2, 3, 4].map((i): RawWireOp => ["drawFastVLine", CX0 + Math.round(((CX1 - CX0) * i) / 4), CY0, CY1 - CY0 + 1, GRID]),
  // Axis labels
  ["text", "{y_max}", CX0 - 4, CY0, 1, 1, "MR", "#8A9BB0"],
  ["text", "{y_min}", CX0 - 4, CY1, 1, 1, "MR", "#8A9BB0"],
  ["text", "{d_start}", CX0, CY1 + 8, 2, 1, "TL", "#8A9BB0"],
  ["text", "{d_end}", CX1, CY1 + 8, 2, 1, "TR", "#8A9BB0"],
  // The line
  ...Array.from({ length: SEG }, (_, i): RawWireOp => [
    "drawLine",
    `{s${i}x0}`,
    `{s${i}y0}`,
    `{s${i}x1}`,
    `{s${i}y1}`,
    LINE,
  ]),
];

const template: Template = {
  id: "audusd-chart",
  name: "AUD/USD chart",
  description: "AUD/USD over the last 30 days as a line chart, with the latest rate and the 30-day change in green or red.",
  apis: ["Frankfurter"],
  category: "finance",
  dataCode: code,
  rows: rows("audusd-chart", wire),
  sampleVars: {"asof":"ECB 19 Nov","chg":"-4.29%","chg_col":"#FF5A5F","chg_label":"30 days","d_end":"19 Nov","d_start":"22 Oct","pair":"AUD/USD","rate":"0.6711","s0x0":52,"s0x1":65,"s0y0":107,"s0y1":103,"s10x0":181,"s10x1":194,"s10y0":111,"s10y1":153,"s11x0":194,"s11x1":207,"s11y0":153,"s11y1":146,"s12x0":207,"s12x1":220,"s12y0":146,"s12y1":143,"s13x0":220,"s13x1":233,"s13y0":143,"s13y1":157,"s14x0":233,"s14x1":246,"s14y0":157,"s14y1":170,"s15x0":246,"s15x1":258,"s15y0":170,"s15y1":182,"s16x0":258,"s16x1":271,"s16y0":182,"s16y1":191,"s17x0":271,"s17x1":284,"s17y0":191,"s17y1":198,"s18x0":284,"s18x1":297,"s18y0":198,"s18y1":199,"s19x0":297,"s19x1":310,"s19y0":199,"s19y1":206,"s1x0":65,"s1x1":78,"s1y0":103,"s1y1":103,"s20x0":0,"s20x1":0,"s20y0":-200,"s20y1":-200,"s21x0":0,"s21x1":0,"s21y0":-200,"s21y1":-200,"s22x0":0,"s22x1":0,"s22y0":-200,"s22y1":-200,"s23x0":0,"s23x1":0,"s23y0":-200,"s23y1":-200,"s2x0":78,"s2x1":91,"s2y0":103,"s2y1":100,"s3x0":91,"s3x1":104,"s3y0":100,"s3y1":100,"s4x0":104,"s4x1":117,"s4y0":100,"s4y1":102,"s5x0":117,"s5x1":129,"s5y0":102,"s5y1":103,"s6x0":129,"s6x1":142,"s6y0":103,"s6y1":108,"s7x0":142,"s7x1":155,"s7y0":108,"s7y1":116,"s8x0":155,"s8x1":168,"s8y0":116,"s8y1":106,"s9x0":168,"s9x1":181,"s9y0":106,"s9y1":111,"y_max":"0.7033","y_min":"0.6711"},
};

export default template;
