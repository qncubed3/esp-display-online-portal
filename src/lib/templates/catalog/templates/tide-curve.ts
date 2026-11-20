import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Tide curve: modelled sea level over 24 hours (6 h back, 18 h ahead) with a "now" marker,
// high and low times on the curve, and the next high and low in cards.

const N = 24; // hours across the chart (N + 1 points)
const X0 = 16; // x of the first point
const STEP = 12; // px per hour
const TY0 = 96, TY1 = 204; // chart top and bottom
const EX = 5; // high/low marker slots

const baseCode = String.raw`// Modelled tide (sea level vs mean sea level) from Open-Meteo Marine (free, no key).
// Set PLACE, LAT and LON to a point out on the water: land cells return no data.
// Times are local to that point. A model estimate only, NOT for navigation.
const PLACE = "PORT PHILLIP";
const LAT = -38.1;
const LON = 144.9;

const N = 24, BACK = 6; // hours shown, and how many of them are before now
const X0 = 16, STEP = 12; // keep in step with Draw
const TY0 = 96, TY1 = 204, PAD = 16;
const HIDE = -200;

let r = null;
try {
  r = await get(
    "https://marine-api.open-meteo.com/v1/marine?latitude=" + LAT + "&longitude=" + LON +
      "&hourly=sea_level_height_msl&past_days=1&forecast_days=2&timezone=auto",
    { cache: 3600 },
  );
} catch (e) {
  console.log("marine api failed:", e.message);
}

const h = (r && r.hourly) || {};
const times = h.time || [];
const lv = h.sea_level_height_msl || [];
const offset = (r && typeof r.utc_offset_seconds === "number") ? r.utc_offset_seconds : 0;

// API times are local wall-clock; read them as UTC and shift "now" by the same offset.
const tms = (t) => Date.parse(t + ":00Z");
const nowLocal = Date.now() + offset * 1000;
const t0 = times.length ? tms(times[0]) : 0;
const fnow = (nowLocal - t0) / 3600000; // fractional hour index of now

const two = (n) => (n < 10 ? "0" : "") + n;
const hhmm = (ms) => { const d = new Date(ms); return two(d.getUTCHours()) + ":" + two(d.getUTCMinutes()); };
const sgn = (v) => (v >= 0 ? "+" : "") + v.toFixed(2) + " m";
const at = (f) => {
  const i = Math.floor(f), a = lv[i], b = lv[i + 1];
  if (typeof a !== "number" || typeof b !== "number") return null;
  return a + (b - a) * (f - i);
};

const start = Math.floor(fnow) - BACK;
const win = [];
for (let i = 0; i <= N; i++) win.push(lv[start + i]);
const ok = r !== null && start >= 0 && win.every((v) => typeof v === "number");
const cur = ok ? at(fnow) : null;

// Highs and lows: local extremes in the hourly series, refined with a parabola through 3 points.
const ext = [];
for (let i = 1; i < lv.length - 1; i++) {
  const a = lv[i - 1], b = lv[i], c = lv[i + 1];
  if (typeof a !== "number" || typeof b !== "number" || typeof c !== "number") continue;
  const hi = b >= a && b > c, lo = b <= a && b < c;
  if (!hi && !lo) continue;
  const den = a - 2 * b + c;
  const d = den !== 0 ? (0.5 * (a - c)) / den : 0;
  ext.push({ f: i + d, v: b - 0.25 * (a - c) * d, hi: hi });
}
const nextHi = ext.find((e) => e.hi && e.f > fnow);
const nextLo = ext.find((e) => !e.hi && e.f > fnow);
const fms = (f) => t0 + f * 3600000;

export const place = PLACE;
export const clock = times.length ? hhmm(nowLocal) : now("HH:mm");
export const level = cur !== null ? sgn(cur) : "--";
const later = ok ? at(fnow + 0.25) : null;
const rising = cur !== null && later !== null && later > cur;
export const trend = cur !== null && later !== null ? (rising ? "Rising" : "Falling") : "";
export const trend_col = rising ? "#4CE08A" : "#FFB040";
// Arrow triangle: tip up when rising, down when falling; hidden without data.
const AX = 14, AY = 76;
export const ar_y1 = trend ? (rising ? AY - 5 : AY + 5) : HIDE;
export const ar_y2 = trend ? (rising ? AY + 5 : AY - 5) : HIDE;
export const ar_x = AX;
export const hi_time = nextHi ? hhmm(fms(nextHi.f)) : "--:--";
export const hi_level = nextHi ? sgn(nextHi.v) : "";
export const lo_time = nextLo ? hhmm(fms(nextLo.f)) : "--:--";
export const lo_level = nextLo ? sgn(nextLo.v) : "";
export const status = ok ? "" : "Tide data unavailable";

// Vertical scale over the window and the extremes in it, padded so labels fit.
const vmax = ok ? Math.max.apply(null, win) : 1;
const vmin = ok ? Math.min.apply(null, win) : 0;
const span = vmax - vmin || 1;
const py = (v) => Math.round(TY1 - PAD - ((TY1 - TY0 - 2 * PAD) * (v - vmin)) / span);
const fx = (f) => Math.round(X0 + (f - start) * STEP);
export const now_x = ok ? fx(fnow) : HIDE;
export const now_y = ok ? py(cur) : HIDE;
export const zero_y = ok && vmin < 0 && vmax > 0 ? py(0) : HIDE;
const hourAt = (i) => (ok ? times[start + i].slice(11, 16) : "");
const inWin = ext.filter((e) => ok && e.f >= start + 0.3 && e.f <= start + N - 0.3);
const ex = (k) => {
  const e = inWin[k];
  if (!e) return { x: HIDE, y: HIDE, ly: HIDE, t: "" };
  const y = py(e.v);
  return { x: fx(e.f), y: y, ly: e.hi ? y - 5 : y + 5, t: Math.abs(e.f - fnow) < 1.5 ? "" : hhmm(fms(e.f)) };
};
`;

const pointExports = Array.from({ length: N + 1 }, (_, i) =>
  `export const y${i} = ok ? py(win[${i}]) : TY1;
export const z${i} = y${i} - 1;`,
).join("\n");

const exExports = Array.from({ length: EX }, (_, k) =>
  [
    `const e${k} = ex(${k});`,
    `export const ex${k}_x = e${k}.x, ex${k}_y = e${k}.y, ex${k}_ly = e${k}.ly, ex${k}_t = e${k}.t;`,
    `export const ex${k}_d = inWin[${k}] && inWin[${k}].hi ? "BC" : "TC";`,
  ].join("\n"),
).join("\n");

const labelExports = [0, 6, 12, 18, 24].map((i) => `export const h${i} = hourAt(${i});`).join("\n");

const code = baseCode + pointExports + "\n" + exExports + "\n" + labelExports + "\n";

const HEAD = "#06304A";
const CARD = "#0E2236";
const LABEL = "#8FB0CC";
const GRID = "#1E3448";
const SEA = "#0B3C66";
const LINE = "#4FD2FF";
const HIGH = "#7FD8FF";
const LOW = "#FFB040";

const px = (i: number) => X0 + i * STEP;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "TIDE", 8, 13, 2, 1, "ML", LINE],
  ["text", "{place}", 48, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C0D8EC"],

  // Now: level and trend
  ["text", "NOW", 8, 31, 1, 1, "TL", LABEL],
  ["text", "{level}", 8, 40, 4, 1, "TL", "#FFFFFF"],
  ["fillTriangle", "{ar_x}", "{ar_y1}", 8, "{ar_y2}", 20, "{ar_y2}", "{trend_col}"],
  ["text", "{trend}", 26, 76, 2, 1, "ML", "{trend_col}"],

  // Next high and low cards
  ["fillRoundRect", 124, 32, 92, 52, 6, CARD],
  ["fillRoundRect", 220, 32, 92, 52, 6, CARD],
  ["text", "NEXT HIGH", 132, 37, 1, 1, "TL", HIGH],
  ["text", "{hi_time}", 132, 48, 4, 1, "TL", "#FFFFFF"],
  ["text", "{hi_level}", 132, 74, 1, 1, "TL", LABEL],
  ["text", "NEXT LOW", 228, 37, 1, 1, "TL", LOW],
  ["text", "{lo_time}", 228, 48, 4, 1, "TL", "#FFFFFF"],
  ["text", "{lo_level}", 228, 74, 1, 1, "TL", LABEL],

  // Chart frame: hour grid every 6 hours and the mean-sea-level line
  ...[0, 6, 12, 18, 24].map((i): RawWireOp => ["drawFastVLine", px(i), TY0, TY1 - TY0, GRID]),
  // Sea area under the curve: two triangles per hour down to the baseline
  ...Array.from({ length: N }, (_, i): RawWireOp[] => [
    ["fillTriangle", px(i), `{y${i}}`, px(i + 1), `{y${i + 1}}`, px(i), TY1, SEA],
    ["fillTriangle", px(i + 1), `{y${i + 1}}`, px(i + 1), TY1, px(i), TY1, SEA],
  ]).flat(),
  ["drawFastHLine", px(0), "{zero_y}", px(N) - px(0), "#2E5A80"],
  // Curve, drawn twice for a 2 px line
  ...Array.from({ length: N }, (_, i): RawWireOp[] => [
    ["drawLine", px(i), `{y${i}}`, px(i + 1), `{y${i + 1}}`, LINE],
    ["drawLine", px(i), `{z${i}}`, px(i + 1), `{z${i + 1}}`, LINE],
  ]).flat(),
  ["drawFastHLine", px(0), TY1, px(N) - px(0), "#4A6A88"],
  // High and low markers with their times
  ...Array.from({ length: EX }, (_, k): RawWireOp[] => [
    ["fillCircle", `{ex${k}_x}`, `{ex${k}_y}`, 2, "#FFFFFF"],
    ["text", `{ex${k}_t}`, `{ex${k}_x}`, `{ex${k}_ly}`, 1, 1, `{ex${k}_d}`, "#FFFFFF"],
  ]).flat(),
  // Now marker
  ["drawFastVLine", "{now_x}", TY0 - 4, TY1 - TY0 + 4, "#FFFFFF"],
  ["fillCircle", "{now_x}", "{now_y}", 4, "#FFFFFF"],
  ["fillCircle", "{now_x}", "{now_y}", 2, LINE],
  ["text", "NOW", "{now_x}", TY0 - 6, 1, 1, "BC", "#FFFFFF"],
  ["text", "{status}", 160, 150, 2, 1, "MC", "#FF8060"],
  // Hour labels
  ...[0, 6, 12, 18, 24].map((i): RawWireOp => ["text", `{h${i}}`, px(i), TY1 + 4, 1, 1, i === 0 ? "TL" : i === 24 ? "TR" : "TC", LABEL]),
  // Footer
  ["text", "Model estimate, not for navigation", 8, 230, 1, 1, "ML", "#6A7A90"],
  ["text", "Open-Meteo", 312, 230, 1, 1, "MR", "#6A7A90"],
];

const template: Template = {
  id: "tide-curve",
  name: "Tide curve",
  description: "Modelled sea level over 24 hours as a curve with a now marker, high and low times, and the next high and low tide.",
  apis: ["Open-Meteo Marine"],
  category: "science",
  dataCode: code,
  rows: rows("tide-curve", wire),
  sampleVars: {"ar_x":14,"ar_y1":71,"ar_y2":81,"clock":"01:22","ex0_d":"TC","ex0_ly":187,"ex0_t":"","ex0_x":87,"ex0_y":182,"ex1_d":"BC","ex1_ly":106,"ex1_t":"07:20","ex1_x":164,"ex1_y":111,"ex2_d":"TC","ex2_ly":193,"ex2_t":"14:00","ex2_x":244,"ex2_y":188,"ex3_d":"TC","ex3_ly":-200,"ex3_t":"","ex3_x":-200,"ex3_y":-200,"ex4_d":"TC","ex4_ly":-200,"ex4_t":"","ex4_x":-200,"ex4_y":-200,"h0":"19:00","h12":"07:00","h18":"13:00","h24":"19:00","h6":"01:00","hi_level":"+0.50 m","hi_time":"07:20","level":"-0.34 m","lo_level":"-0.43 m","lo_time":"14:00","now_x":93,"now_y":180,"place":"PORT PHILLIP","status":"","trend":"Rising","trend_col":"#4CE08A","y0":129,"y1":131,"y10":137,"y11":121,"y12":112,"y13":114,"y14":124,"y15":138,"y16":156,"y17":173,"y18":184,"y19":188,"y2":139,"y20":184,"y21":175,"y22":161,"y23":144,"y24":130,"y3":152,"y4":167,"y5":178,"y6":182,"y7":177,"y8":167,"y9":153,"z0":128,"z1":130,"z10":136,"z11":120,"z12":111,"z13":113,"z14":123,"z15":137,"z16":155,"z17":172,"z18":183,"z19":187,"z2":138,"z20":183,"z21":174,"z22":160,"z23":143,"z24":129,"z3":151,"z4":166,"z5":177,"z6":181,"z7":176,"z8":166,"z9":152,"zero_y":152},
};

export default template;
