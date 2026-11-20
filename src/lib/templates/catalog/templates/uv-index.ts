import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// UV index now, an hourly bar chart of the day's UV (6am to 8pm), and the sun-protection window (UV 3+).

const H0 = 6; // first local hour on the chart
const N = 15; // hours shown (6 to 20)
const X0 = 40; // x centre of the first bar
const STEP = 19; // px between bars
const BW = 13; // bar width
const BASE = 204; // chart baseline y
const PX_PER_UV = 7; // bar height per UV unit (UV 12 = 84 px)
const UV_TOP = 12; // chart top in UV units

const baseCode = String.raw`// UV index now, today's hourly UV forecast and the sun-protection window
// from currentuvindex.com (free, no key, about 500 requests a day per IP).
// Set PLACE, LAT and LON to your location. Hours are shown in the Service's timezone.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const PROTECT = 3; // UV at or above this needs sun protection

const H0 = 6, N = 15; // chart hours (keep in step with Draw)
const X0 = 40, STEP = 19, BASE = 204, PX_PER_UV = 7, UV_TOP = 12;
const HIDE = -200;

// UV bands (rounded index): [upper limit, name, colour, advice]
const UV = [
  [2, "Low", "#64D228", "No protection needed"],
  [5, "Moderate", "#F7E400", "Hat and sunscreen"],
  [7, "High", "#FF8C1E", "Hat, sunscreen, shade"],
  [10, "Very high", "#FF4040", "Seek shade at midday"],
  [Infinity, "Extreme", "#B482FF", "Avoid the midday sun"],
];
const bandOf = (v) => UV.findIndex((b) => Math.round(v) <= b[0]);

let r = null;
try {
  r = await get(
    "https://currentuvindex.com/api/v1/uvi?latitude=" + LAT + "&longitude=" + LON,
    { cache: 1800 },
  );
} catch (e) {
  console.log("currentuvindex failed:", e.message);
}

// The API gives UTC times. Work out the Service timezone's offset from now().
const nowLocal = now("YYYY-MM-DD HH:mm");
const localMs = Date.UTC(
  Number(nowLocal.slice(0, 4)), Number(nowLocal.slice(5, 7)) - 1, Number(nowLocal.slice(8, 10)),
  Number(nowLocal.slice(11, 13)), Number(nowLocal.slice(14, 16)),
);
const offMs = Math.round((localMs - Date.now()) / 900000) * 900000;
const pad = (n) => (n < 10 ? "0" : "") + n;
const dayKey = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());

// All hourly points (history, now, forecast) keyed by local day and hour
const byDay = {};
const add = (p) => {
  if (!p || !p.time || typeof p.uvi !== "number") return;
  const d = new Date(Date.parse(p.time) + offMs);
  const k = dayKey(d);
  if (!byDay[k]) byDay[k] = {};
  byDay[k][d.getUTCHours()] = p.uvi;
};
if (r && r.ok !== false) {
  (r.history || []).forEach(add);
  add(r.now);
  (r.forecast || []).forEach(add);
}

// Show today, or tomorrow once the evening has come
const hourNow = Number(nowLocal.slice(11, 13));
const showTomorrow = hourNow >= 19;
const todayKey = nowLocal.slice(0, 10);
const tomorrowKey = dayKey(new Date(localMs + 86400000));
const day = byDay[showTomorrow ? tomorrowKey : todayKey] || {};
const ok = Object.keys(day).length > 0;

export const place = PLACE;
export const clock = now("ddd HH:mm");

// UV now
const uvNow = r && r.now && typeof r.now.uvi === "number" ? r.now.uvi : null;
const ni = uvNow == null ? -1 : bandOf(uvNow);
export const uv_val = uvNow == null ? "--" : String(Math.round(uvNow));
export const uv_cat = ni < 0 ? "No data" : UV[ni][1];
export const uv_col = ni < 0 ? "#808080" : UV[ni][2];
export const uv_tip = ni < 0 ? "UV forecast unavailable" : UV[ni][3];

// Peak for the charted day
let peakH = -1;
for (let h = 0; h < 24; h++) {
  if (day[h] != null && (peakH < 0 || day[h] > day[peakH])) peakH = h;
}
const peak = peakH < 0 ? null : day[peakH];
export const peak_txt = peak == null ? "" :
  (showTomorrow ? "Tomorrow peak " : "Peak ") + Math.round(peak) + (peak >= 0.5 ? " at " + pad(peakH) + ":00" : "");
export const chart_lbl = ok ? (showTomorrow ? "TOMORROW" : "TODAY") : "";

// Sun-protection window: where the hourly UV crosses PROTECT, interpolated between hours
const at = (h) => (day[h] == null ? 0 : day[h]);
let first = -1, last = -1;
for (let h = 0; h < 24; h++) {
  if (at(h) >= PROTECT) { if (first < 0) first = h; last = h; }
}
const hm = (x) => {
  const m = Math.round((x * 60) / 10) * 10;
  return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
};
const cross = (a, b) => {
  const va = at(a), vb = at(b);
  return va === vb ? a : a + ((PROTECT - va) / (vb - va)) * (b - a);
};
const pStart = first < 0 ? 0 : first > 0 ? cross(first - 1, first) : 0;
const pEnd = last < 0 ? 0 : last < 23 ? cross(last, last + 1) : 24;
export const prot_lbl = ok ? (first < 0 ? "No sun protection needed" : "Sun protection") : "No data";
export const prot_times = ok && first >= 0 ? hm(pStart) + " - " + hm(pEnd) : "";
const pi = peak == null ? -1 : bandOf(peak);
export const prot_col = first < 0 || pi < 0 ? "#FFFFFF" : UV[pi][2];

// Column highlight for the current hour (today only)
const ci = hourNow - H0;
export const cur_x = !showTomorrow && ok && ci >= 0 && ci < N ? X0 + ci * STEP - 9 : HIDE;
`;

// Data can't export from a loop, so the per-hour exports are generated here.
const barExports = Array.from({ length: N }, (_, i) =>
  [
    `const v${i} = day[${H0 + i}];`,
    `const h${i} = v${i} == null || v${i} < 0.05 ? 0 : Math.max(1, Math.round(Math.min(v${i}, UV_TOP) * PX_PER_UV));`,
    `export const by${i} = h${i} > 0 ? BASE - h${i} : HIDE;`,
    `export const bh${i} = h${i};`,
    `export const bc${i} = v${i} == null ? "#404040" : UV[bandOf(v${i})][2];`,
    `export const bv${i} = v${i} != null && Math.round(v${i}) >= 1 ? String(Math.round(v${i})) : "";`,
    `export const bvy${i} = h${i} > 0 ? BASE - h${i} - 2 : HIDE;`,
  ].join("\n"),
).join("\n");

const code = baseCode + barExports + "\n";

const HEAD = "#2A1E00";
const LABEL = "#A0A8B4";
const GRID = "#262C34";
const CHART_W = (N - 1) * STEP + 18;
const px = (i: number) => X0 + i * STEP;
const uvY = (v: number) => BASE - v * PX_PER_UV;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "UV INDEX", 8, 13, 2, 1, "ML", "#FFD24A"],
  ["text", "{place}", 76, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#D8CFC0"],
  // UV now: big number, category, advice and the day's peak
  ["text", "{uv_val}", 10, 34, 4, 2, "TL", "{uv_col}"],
  ["text", "NOW", 12, 90, 1, 1, "TL", LABEL],
  ["text", "{uv_cat}", 84, 34, 4, 1, "TL", "{uv_col}"],
  ["text", "{uv_tip}", 84, 62, 2, 1, "TL", "#FFFFFF"],
  ["text", "{peak_txt}", 84, 80, 2, 1, "TL", LABEL],
  // Chart: current-hour column, grid, protection threshold
  ["fillRect", "{cur_x}", uvY(UV_TOP) - 12, 18, BASE - uvY(UV_TOP) + 12, "#1A2230"],
  ["text", "{chart_lbl}", 312, 100, 1, 1, "TR", LABEL],
  ...[6, 9, 12].map((v): RawWireOp => ["drawFastHLine", X0 - 9, uvY(v), CHART_W, GRID]),
  ...[3, 6, 9, 12].map((v): RawWireOp => ["text", String(v), X0 - 14, uvY(v), 1, 1, "MR", LABEL]),
  // Bars coloured by UV band, with the rounded value on top
  ...Array.from({ length: N }, (_, i): RawWireOp[] => [
    ["fillRect", px(i) - Math.floor(BW / 2), `{by${i}}`, BW, `{bh${i}}`, `{bc${i}}`],
    ["text", `{bv${i}}`, px(i) + 1, `{bvy${i}}`, 1, 1, "BC", "#D0D0D0"],
  ]).flat(),
  ["drawFastHLine", X0 - 9, uvY(3), CHART_W, "#8A7A30"],
  ["drawFastHLine", X0 - 9, BASE, CHART_W, "#6A7280"],
  // Hour labels every 3 hours
  ...[0, 3, 6, 9, 12].map((i): RawWireOp => ["text", String(H0 + i).padStart(2, "0"), px(i) + 1, BASE + 4, 1, 1, "TC", LABEL]),
  // Footer: sun-protection window and credit
  ["fillRect", 0, 218, 320, 22, "#14181E"],
  ["text", "{prot_lbl}", 8, 229, 2, 1, "ML", LABEL],
  ["text", "{prot_times}", 112, 229, 2, 1, "ML", "{prot_col}"],
  ["text", "currentuvindex.com", 312, 229, 1, 1, "MR", "#5A6270"],
];

const template: Template = {
  id: "uv-index",
  name: "UV index today",
  description: "The UV index now in its band colour, an hourly bar chart of the day's UV forecast, and the sun-protection window when UV is 3 or more.",
  apis: ["currentuvindex.com"],
  category: "weather",
  dataCode: code,
  rows: rows("uv-index", wire),
  sampleVars: {"bc0":"#64D228","bc1":"#64D228","bc10":"#FF8C1E","bc11":"#F7E400","bc12":"#64D228","bc13":"#64D228","bc14":"#64D228","bc2":"#64D228","bc3":"#64D228","bc4":"#64D228","bc5":"#F7E400","bc6":"#FF4040","bc7":"#B482FF","bc8":"#FF4040","bc9":"#FF4040","bh0":0,"bh1":1,"bh10":46,"bh11":28,"bh12":13,"bh13":4,"bh14":1,"bh2":2,"bh3":3,"bh4":8,"bh5":31,"bh6":66,"bh7":75,"bh8":71,"bh9":62,"bv0":"","bv1":"","bv10":"7","bv11":"4","bv12":"2","bv13":"1","bv14":"","bv2":"","bv3":"","bv4":"1","bv5":"4","bv6":"9","bv7":"11","bv8":"10","bv9":"9","bvy0":-200,"bvy1":201,"bvy10":156,"bvy11":174,"bvy12":189,"bvy13":198,"bvy14":201,"bvy2":200,"bvy3":199,"bvy4":194,"bvy5":171,"bvy6":136,"bvy7":127,"bvy8":131,"bvy9":140,"by0":-200,"by1":203,"by10":158,"by11":176,"by12":191,"by13":200,"by14":203,"by2":202,"by3":201,"by4":196,"by5":173,"by6":138,"by7":129,"by8":133,"by9":142,"chart_lbl":"TODAY","clock":"Sat 01:27","cur_x":-200,"peak_txt":"Peak 11 at 13:00","place":"MELBOURNE","prot_col":"#B482FF","prot_lbl":"Sun protection","prot_times":"10:30 - 17:30","uv_cat":"Low","uv_col":"#64D228","uv_tip":"No protection needed","uv_val":"0"},
};

export default template;
