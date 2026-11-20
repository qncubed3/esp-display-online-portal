import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Today's modelled river flow, its trend against yesterday, and 7 daily forecast bars with the peak picked out.

const N = 7; // days shown (keep in step with Data)
const BX0 = 12; // x of the first bar
const BSTEP = 43; // px between bars
const BW = 34; // bar width
const BASE = 206; // bar baseline
const BH = 76; // bar height at the week's maximum

const baseCode = String.raw`// River discharge forecast from the Open-Meteo Flood API (GloFAS model, free, no key).
// The point snaps to the nearest modelled river cell (about 5 km), so pick LAT/LON on the river.
const PLACE = "YARRA RIVER";
const LAT = -37.81;
const LON = 144.96;

const N = 7;
const BX0 = 12, BSTEP = 43, BW = 34; // keep in step with Draw
const BASE = 206, BH = 76;
const HIDE = -200;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let r = null;
try {
  r = await get(
    "https://flood-api.open-meteo.com/v1/flood?latitude=" + LAT + "&longitude=" + LON +
      "&daily=river_discharge,river_discharge_median&past_days=1&forecast_days=9",
    { cache: 21600 },
  );
} catch (e) {
  console.log("flood api failed:", e.message);
}

const d = r && r.daily;
const times = (d && d.time) || [];
const flow = (d && d.river_discharge) || [];
const med = (d && d.river_discharge_median) || [];

// Find today in the series (the API starts a day or two back); fall back to the first non-past day.
const today = now("YYYY-MM-DD");
let ti = times.indexOf(today);
if (ti < 0) ti = Math.min(1, times.length - 1);

const pts = []; // { t, v, m }
for (let i = Math.max(ti, 0); i < times.length && pts.length < N; i++) {
  if (flow[i] == null) break;
  pts.push({ t: times[i], v: flow[i], m: med[i] });
}
const ok = pts.length >= 1;

const fmt = (v) => (v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
const dayName = (t) => DAYS[new Date(t + "T00:00:00Z").getUTCDay()];

export const place = PLACE;
export const clock = now("ddd HH:mm");
export const flow_now = ok ? fmt(pts[0].v) : "--";
export const unit = ok ? "m3/s today" : "No data";

// Trend: today against yesterday
const prev = ti > 0 ? flow[ti - 1] : null;
const delta = ok && prev != null ? pts[0].v - prev : null;
const rel = delta != null && prev > 0 ? delta / prev : 0;
const trend = delta == null ? "" : rel > 0.05 ? "up" : rel < -0.05 ? "down" : "flat";
export const trend_txt = trend === "up" ? "RISING" : trend === "down" ? "FALLING" : trend === "flat" ? "STEADY" : "";
export const trend_col = trend === "up" ? "#FFB040" : trend === "down" ? "#4FD08A" : "#C0C8D0";
export const delta_txt = delta == null ? "" : (delta >= 0 ? "+" : "-") + fmt(Math.abs(delta)) + " since yesterday";
// Arrow y coordinates: apex and base; hidden off-screen when not used
export const up_a = trend === "up" ? 50 : HIDE;
export const up_b = trend === "up" ? 76 : HIDE;
export const dn_a = trend === "down" ? 78 : HIDE;
export const dn_b = trend === "down" ? 52 : HIDE;
export const flat_y = trend === "flat" ? 61 : HIDE;

// Compared with the long-term median for the date
const m0 = ok ? pts[0].m : null;
export const vs_med = m0 != null && m0 > 0 ? (pts[0].v / m0).toFixed(1) + "x median for date" : "";

// Peak of the week
let pk = 0;
for (let i = 1; i < pts.length; i++) if (pts[i].v > pts[pk].v) pk = i;
export const peak_txt = ok ? "Peak " + (pk === 0 ? "today" : dayName(pts[pk].t)) + " " + fmt(pts[pk].v) : "";
export const chart_title = ok ? pts.length + "-DAY FORECAST" : "FORECAST UNAVAILABLE";

const vmax = ok ? Math.max.apply(null, pts.map((p) => p.v)) : 0;
const bh = (v) => (vmax > 0 ? Math.max(2, Math.round((v / vmax) * BH)) : 2);
`;

// Data can't export from a loop, so the per-day exports are generated here.
const barExports = Array.from({ length: N }, (_, i) =>
  [
    `const p${i} = pts[${i}];`,
    `const h${i} = p${i} ? bh(p${i}.v) : 0;`,
    `export const by${i} = p${i} ? BASE - h${i} : HIDE;`,
    `export const bh${i} = h${i};`,
    `export const bc${i} = ${i} === pk ? "#FFB040" : ${i} === 0 ? "#5FC8FF" : "#2E6FA8";`,
    `export const bv${i} = p${i} ? fmt(p${i}.v) : "";`,
    `export const bvc${i} = ${i} === pk ? "#FFB040" : "#B8C4D0";`,
    `export const bvy${i} = p${i} ? BASE - h${i} - 3 : HIDE;`,
    `export const bd${i} = p${i} ? (${i} === 0 ? "Today" : dayName(p${i}.t)) : "";`,
  ].join("\n"),
).join("\n");

const code = baseCode + barExports + "\n";

const BG = "#000000";
const HEAD = "#0A2236";
const LABEL = "#8A9BB0";
const GRID = "#1C2836";

const cx = (i: number) => BX0 + BW / 2 + i * BSTEP;
const AX = 146; // centre of the trend arrow

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "{place}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", LABEL],
  // Today's flow, big
  ["text", "{unit}", 8, 34, 1, 1, "TL", LABEL],
  ["text", "{flow_now}", 8, 46, 4, 2, "TL", "#FFFFFF"],
  // Trend arrow (only one of the three shows)
  ["fillTriangle", AX, "{up_a}", AX - 12, "{up_b}", AX + 12, "{up_b}", "{trend_col}"],
  ["fillTriangle", AX, "{dn_a}", AX - 12, "{dn_b}", AX + 12, "{dn_b}", "{trend_col}"],
  ["fillRect", AX - 12, "{flat_y}", 24, 6, "{trend_col}"],
  // Right column: trend, change, median, peak
  ["text", "{trend_txt}", 170, 36, 2, 1, "TL", "{trend_col}"],
  ["text", "{delta_txt}", 170, 56, 1, 1, "TL", "#C0C8D0"],
  ["text", "{vs_med}", 170, 70, 1, 1, "TL", LABEL],
  ["text", "{peak_txt}", 170, 84, 1, 1, "TL", "#FFB040"],
  // Chart
  ["drawFastHLine", 8, 102, 304, GRID],
  ["text", "{chart_title}", 8, 108, 1, 1, "TL", LABEL],
  ["text", "Open-Meteo GloFAS", 312, 108, 1, 1, "TR", "#5A6A80"],
  ...Array.from({ length: N }, (_, i): RawWireOp[] => [
    ["fillRect", BX0 + i * BSTEP, `{by${i}}`, BW, `{bh${i}}`, `{bc${i}}`],
    ["text", `{bv${i}}`, cx(i), `{bvy${i}}`, 1, 1, "BC", `{bvc${i}}`],
    ["text", `{bd${i}}`, cx(i), BASE + 5, 1, 1, "TC", i === 0 ? "#FFFFFF" : LABEL],
  ]).flat(),
  ["drawFastHLine", 8, BASE, 304, "#6A7A90"],
];

const template: Template = {
  id: "river-discharge",
  name: "River flow forecast",
  description: "Today's modelled river discharge in m3/s with a rising or falling arrow, how it compares with normal, and 7 daily forecast bars with the peak day picked out.",
  apis: ["Open-Meteo"],
  category: "science",
  dataCode: code,
  rows: rows("river-discharge", wire),
  sampleVars: {"bc0":"#FFB040","bc1":"#2E6FA8","bc2":"#2E6FA8","bc3":"#2E6FA8","bc4":"#2E6FA8","bc5":"#2E6FA8","bc6":"#2E6FA8","bd0":"Today","bd1":"Sun","bd2":"Mon","bd3":"Tue","bd4":"Wed","bd5":"Thu","bd6":"Fri","bh0":76,"bh1":48,"bh2":51,"bh3":36,"bh4":24,"bh5":17,"bh6":13,"bv0":"65.7","bv1":"41.9","bv2":"44.0","bv3":"30.9","bv4":"20.8","bv5":"14.4","bv6":"11.3","bvc0":"#FFB040","bvc1":"#B8C4D0","bvc2":"#B8C4D0","bvc3":"#B8C4D0","bvc4":"#B8C4D0","bvc5":"#B8C4D0","bvc6":"#B8C4D0","bvy0":127,"bvy1":155,"bvy2":152,"bvy3":167,"bvy4":179,"bvy5":186,"bvy6":190,"by0":130,"by1":158,"by2":155,"by3":170,"by4":182,"by5":189,"by6":193,"chart_title":"7-DAY FORECAST","clock":"Sat 01:21","delta_txt":"+55.6 since yesterday","dn_a":-200,"dn_b":-200,"flat_y":-200,"flow_now":"65.7","peak_txt":"Peak today 65.7","place":"YARRA RIVER","trend_col":"#FFB040","trend_txt":"RISING","unit":"m3/s today","up_a":50,"up_b":76,"vs_med":"1.2x median for date"},
};

export default template;
