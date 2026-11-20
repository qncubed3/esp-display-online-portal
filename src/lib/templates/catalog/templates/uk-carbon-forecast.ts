import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// The next 48 hours of UK grid carbon intensity as hourly bars, with the cleanest 2-hour window marked.

const N = 48; // hourly bars (keep in step with Data)
const X0 = 8; // x of the first bar
const STEP = 6; // px per bar
const BW = 5; // bar width
const CT = 108, CB = 194; // chart top and baseline

const baseCode = String.raw`// UK grid carbon intensity forecast for the next 48 hours from the National Energy System
// Operator's Carbon Intensity API (free, no key, CC-BY). Finds the cleanest window to plug in.
const API = "https://api.carbonintensity.org.uk";
const WINDOW_HOURS = 2; // length of the best window to look for
const CACHE = 1800; // the forecast updates every half hour

const N = 48;
const X0 = 8, STEP = 6, BW = 5; // keep in step with Draw
const CT = 108, CB = 194;
const HIDE = -200;

const INDEX_COL = {
  "very low": "#00D26A", "low": "#9BE15D", "moderate": "#FFC83D", "high": "#FF8A3D", "very high": "#FF4B4B",
};

// UK local time (GMT, or BST from the last Sunday of March to the last Sunday of October, 01:00 UTC).
function lastSunday(y, month) {
  const d = new Date(Date.UTC(y, month + 1, 0, 1));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
}
function uk(ms) {
  const y = new Date(ms).getUTCFullYear();
  const bst = ms >= lastSunday(y, 2) && ms < lastSunday(y, 9);
  return { d: new Date(ms + (bst ? 3600000 : 0)), zone: bst ? "BST" : "GMT" };
}
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (d) => pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const nowMs = Date.now();
const here = uk(nowMs);
export const clock = hhmm(here.d) + " " + here.zone;

// Half-hour forecasts from the current slot. The URL is rounded down to the half hour so the cache works.
let slots = [];
try {
  const slot = new Date(Math.floor(nowMs / 1800000) * 1800000).toISOString().slice(0, 16) + "Z";
  const r = await get(API + "/intensity/" + slot + "/fw48h", { cache: CACHE });
  slots = r.data
    .filter((s) => Date.parse(s.to) > nowMs && s.intensity && typeof s.intensity.forecast === "number")
    .map((s) => ({ t: Date.parse(s.from), v: s.intensity.forecast, idx: s.intensity.index }));
} catch (e) {
  console.log("carbon intensity failed:", e.message);
}
const ok = slots.length >= 4;

// Hourly bars: each pairs two half hours, coloured by the dirtier one.
const bars = [];
for (let i = 0; i + 1 < slots.length && bars.length < N; i += 2) {
  const a = slots[i], b = slots[i + 1];
  const worse = b.v > a.v ? b : a;
  bars.push({ v: (a.v + b.v) / 2, idx: worse.idx });
}
const maxV = bars.length ? Math.max.apply(null, bars.map((b) => b.v)) : 100;
const top = Math.max(100, Math.ceil(maxV / 50) * 50);
const py = (v) => Math.round(CB - ((CB - CT) * v) / top);

// Cleanest window of WINDOW_HOURS hours, on half-hour boundaries.
const W = WINDOW_HOURS * 2;
let best = -1, bestAvg = Infinity;
for (let i = 0; i + W <= slots.length; i++) {
  let s = 0;
  for (let k = 0; k < W; k++) s += slots[i + k].v;
  if (s / W < bestAvg) { bestAvg = s / W; best = i; }
}
let bestWhen = "No forecast";
if (best >= 0) {
  const from = slots[best].t;
  const a = uk(from).d, b = uk(from + W * 1800000).d;
  const day = from <= nowMs ? "Now" : a.getUTCDate() === here.d.getUTCDate() ? "Today" : DAYS[a.getUTCDay()];
  bestWhen = day + " " + hhmm(a) + "-" + hhmm(b);
}
export const best_when = bestWhen;
export const best_label = "CLEANEST " + WINDOW_HOURS + " HOURS AHEAD";
export const best_value = best >= 0 ? String(Math.round(bestAvg)) : "--";
export const best_unit = best >= 0 ? "g/kWh avg" : "";
const bestIdx = best >= 0 ? slots[best + Math.floor(W / 2)].idx : "";
export const best_col = INDEX_COL[bestIdx] || "#808080";

const nowV = ok ? slots[0].v : null;
export const now_value = nowV != null ? String(nowV) : "--";
export const now_index = ok ? slots[0].idx.toUpperCase() : "NO DATA";
export const now_col = (ok && INDEX_COL[slots[0].idx]) || "#808080";
const saving = nowV && best >= 0 ? Math.round((1 - bestAvg / nowV) * 100) : 0;
export const saving_text = saving >= 1 ? saving + "% cleaner than now" : best >= 0 ? "Now is the cleanest" : "";

// Best-window outline over the bars (slot index / 2 = bar position).
const bx0 = best >= 0 ? X0 + Math.floor((best / 2) * STEP) - 2 : HIDE;
export const win_x = bx0;
export const win_w = best >= 0 ? W * STEP / 2 + 3 : 0;
export const win_y = ok ? CT - 4 : HIDE;
export const win_h = CB - CT + 6;

// Gridlines at round values that fit the scale.
const GRID = [100, 200, 300, 400];
const gy = GRID.map((g) => (ok && g < top ? py(g) : HIDE));
export const g1_y = gy[0], g2_y = gy[1], g3_y = gy[2], g4_y = gy[3];
export const g1_t = gy[0] > 0 ? "100" : "", g2_t = gy[1] > 0 ? "200" : "";
export const g3_t = gy[2] > 0 ? "300" : "", g4_t = gy[3] > 0 ? "400" : "";

// Midnight lines with day names, and a "12" tick at noon. Skip any too close to "Now".
const mids = [], noons = [];
for (let i = 0; i < slots.length && i < N * 2; i++) {
  const d = uk(slots[i].t).d;
  if (d.getUTCMinutes() !== 0) continue;
  const x = X0 + Math.floor((i / 2) * STEP) - 1;
  if (x < X0 + 22) continue;
  if (d.getUTCHours() === 0) mids.push({ x: x, t: DAYS[d.getUTCDay()] });
  if (d.getUTCHours() === 12) noons.push({ x: x });
}
const mx = (k) => (mids[k] ? mids[k].x : HIDE);
export const m1_x = mx(0), m2_x = mx(1), m3_x = mx(2);
export const m1_t = mids[0] ? mids[0].t : "", m2_t = mids[1] ? mids[1].t : "", m3_t = mids[2] ? mids[2].t : "";
const nx = (k) => (noons[k] ? noons[k].x : HIDE);
export const n1_x = nx(0), n2_x = nx(1), n3_x = nx(2);
export const now_t = ok ? "Now" : "";
export const credit = "carbonintensity.org.uk";
`;

// Data can't export from a loop, so the per-bar exports are generated here.
const barExports = Array.from({ length: N }, (_, i) =>
  [
    `const q${i} = bars[${i}];`,
    `export const by${i} = q${i} ? py(q${i}.v) : HIDE;`,
    `export const bh${i} = q${i} ? Math.max(1, CB - py(q${i}.v)) : 0;`,
    `export const bc${i} = q${i} ? INDEX_COL[q${i}.idx] || "#808080" : "#000000";`,
  ].join("\n"),
).join("\n");

const code = baseCode + barExports + "\n";

const BG = "#000000";
const PANEL = "#141A24";
const MUTED = "#9AA6B8";
const GRIDC = "#1E2633";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, PANEL],
  ["text", "GREENEST TIME TO PLUG IN", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", MUTED],
  // Best window
  ["text", "{best_label}", 8, 34, 1, 1, "TL", MUTED],
  ["text", "{best_when}", 8, 46, 4, 1, "TL", "#FFFFFF"],
  ["text", "{best_value}", 312, 46, 4, 1, "TR", "{best_col}"],
  ["text", "{best_unit}", 312, 74, 1, 1, "TR", MUTED],
  ["text", "{saving_text}", 8, 78, 2, 1, "TL", "#00D26A"],
  // Gridlines and scale
  ...[1, 2, 3, 4].flatMap((n): RawWireOp[] => [
    ["drawFastHLine", X0, `{g${n}_y}`, N * STEP - 1, GRIDC],
    ["text", `{g${n}_t}`, 312, `{g${n}_y}`, 1, 1, "MR", "#5C6878"],
  ]),
  // Midnight lines and noon ticks
  ...[1, 2, 3].map((n): RawWireOp => ["drawFastVLine", `{m${n}_x}`, CT - 4, CB - CT + 4, "#3A4658"]),
  ...[1, 2, 3].map((n): RawWireOp => ["drawFastVLine", `{n${n}_x}`, CB + 1, 4, "#3A4658"]),
  // Best-window outline, drawn under the bars
  ["fillRect", "{win_x}", "{win_y}", "{win_w}", "{win_h}", "#1A2A20"],
  ["drawRect", "{win_x}", "{win_y}", "{win_w}", "{win_h}", "#00D26A"],
  // Hourly bars
  ...Array.from({ length: N }, (_, i): RawWireOp => ["fillRect", X0 + i * STEP, `{by${i}}`, BW, `{bh${i}}`, `{bc${i}}`]),
  ["drawFastHLine", X0, CB, N * STEP - 1, "#6A7A90"],
  // X labels
  ["text", "{now_t}", X0, CB + 4, 1, 1, "TL", "#FFFFFF"],
  ...[1, 2, 3].map((n): RawWireOp => ["text", `{m${n}_t}`, `{m${n}_x}`, CB + 4, 1, 1, "TC", MUTED]),
  // Footer: now
  ["fillRoundRect", 6, 210, 308, 26, 6, PANEL],
  ["text", "NOW", 14, 223, 1, 1, "ML", MUTED],
  ["text", "{now_value}", 38, 223, 2, 1, "ML", "{now_col}"],
  ["text", "g/kWh", 70, 224, 1, 1, "ML", MUTED],
  ["text", "{now_index}", 108, 223, 1, 1, "ML", "{now_col}"],
  ["text", "{credit}", 306, 223, 1, 1, "MR", "#5C6878"],
];

const template: Template = {
  id: "uk-carbon-forecast",
  name: "Greenest time to plug in",
  description: "The UK grid's carbon intensity forecast for the next 48 hours as hourly bars, with the cleanest 2-hour window marked and timed.",
  apis: ["Carbon Intensity API"],
  category: "science",
  dataCode: code,
  rows: rows("uk-carbon-forecast", wire),
  sampleVars: {"bc0":"#FF8A3D","bc1":"#FF8A3D","bc10":"#FF4B4B","bc11":"#FF4B4B","bc12":"#FF4B4B","bc13":"#FF4B4B","bc14":"#FF4B4B","bc15":"#FF8A3D","bc16":"#FF4B4B","bc17":"#FF4B4B","bc18":"#FF4B4B","bc19":"#FF8A3D","bc2":"#FF8A3D","bc20":"#FF8A3D","bc21":"#FF8A3D","bc22":"#FF8A3D","bc23":"#FF8A3D","bc24":"#FF8A3D","bc25":"#FF4B4B","bc26":"#FF4B4B","bc27":"#FF8A3D","bc28":"#FF8A3D","bc29":"#FF8A3D","bc3":"#FF8A3D","bc30":"#FF8A3D","bc31":"#FF8A3D","bc32":"#FF8A3D","bc33":"#FFC83D","bc34":"#FFC83D","bc35":"#FFC83D","bc36":"#FFC83D","bc37":"#9BE15D","bc38":"#9BE15D","bc39":"#9BE15D","bc4":"#FF4B4B","bc40":"#FFC83D","bc41":"#FFC83D","bc42":"#FFC83D","bc43":"#FFC83D","bc44":"#FFC83D","bc45":"#FFC83D","bc46":"#FFC83D","bc47":"#FFC83D","bc5":"#FF4B4B","bc6":"#FF4B4B","bc7":"#FF4B4B","bc8":"#FF4B4B","bc9":"#FF4B4B","best_col":"#9BE15D","best_label":"CLEANEST 2 HOURS AHEAD","best_unit":"g/kWh avg","best_value":"85","best_when":"Sun 03:30-05:30","bh0":74,"bh1":76,"bh10":83,"bh11":82,"bh12":82,"bh13":81,"bh14":79,"bh15":79,"bh16":80,"bh17":82,"bh18":82,"bh19":77,"bh2":78,"bh20":71,"bh21":70,"bh22":71,"bh23":73,"bh24":76,"bh25":79,"bh26":80,"bh27":78,"bh28":76,"bh29":74,"bh3":78,"bh30":72,"bh31":66,"bh32":61,"bh33":52,"bh34":47,"bh35":43,"bh36":33,"bh37":30,"bh38":29,"bh39":30,"bh4":79,"bh40":31,"bh41":33,"bh42":34,"bh43":37,"bh44":40,"bh45":44,"bh46":47,"bh47":51,"bh5":80,"bh6":81,"bh7":82,"bh8":83,"bh9":83,"by0":120,"by1":118,"by10":111,"by11":112,"by12":112,"by13":113,"by14":115,"by15":115,"by16":114,"by17":112,"by18":112,"by19":117,"by2":116,"by20":123,"by21":124,"by22":123,"by23":121,"by24":118,"by25":115,"by26":114,"by27":116,"by28":118,"by29":120,"by3":116,"by30":122,"by31":128,"by32":133,"by33":142,"by34":147,"by35":151,"by36":161,"by37":164,"by38":165,"by39":164,"by4":115,"by40":163,"by41":161,"by42":160,"by43":157,"by44":154,"by45":150,"by46":147,"by47":143,"by5":114,"by6":113,"by7":112,"by8":111,"by9":111,"clock":"14:21 GMT","credit":"carbonintensity.org.uk","g1_t":"100","g1_y":160,"g2_t":"200","g2_y":125,"g3_t":"","g3_y":-200,"g4_t":"","g4_y":-200,"m1_t":"Sat","m1_x":67,"m2_t":"Sun","m2_x":211,"m3_t":"","m3_x":-200,"n1_x":139,"n2_x":283,"n3_x":-200,"now_col":"#FF8A3D","now_index":"HIGH","now_t":"Now","now_value":"211","saving_text":"60% cleaner than now","win_h":92,"win_w":15,"win_x":231,"win_y":104},
};

export default template;
