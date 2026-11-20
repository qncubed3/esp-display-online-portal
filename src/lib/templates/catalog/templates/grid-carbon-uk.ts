import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// UK grid carbon intensity

const gridCode = String.raw`// UK electricity grid from the National Energy System Operator's Carbon Intensity API (free, no key).
// Current carbon intensity, the generation mix, and the cleanest half hour in the next 24 h.
const API = "https://api.carbonintensity.org.uk";
const CACHE = 900; // the API updates every half hour
const BAR_MAX = 88; // px width of the longest mix bar
const ROWS = 8;

const INDEX_COL = {
  "very low": "#00D26A", "low": "#9BE15D", "moderate": "#FFC83D", "high": "#FF8A3D", "very high": "#FF4B4B",
};
const FUELS = {
  gas: { name: "Gas", col: "#FF8C42" }, wind: { name: "Wind", col: "#4FC3F7" },
  nuclear: { name: "Nuclear", col: "#B388FF" }, solar: { name: "Solar", col: "#FFD54F" },
  imports: { name: "Imports", col: "#B0BEC5" }, biomass: { name: "Biomass", col: "#7CB342" },
  hydro: { name: "Hydro", col: "#2E8BFF" }, coal: { name: "Coal", col: "#A1887F" },
};
const LOW_CARBON = ["wind", "solar", "nuclear", "hydro", "biomass"];

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

// Current intensity
let ci = null;
try {
  const r = await get(API + "/intensity", { cache: CACHE });
  ci = r.data[0].intensity;
} catch (e) {}
const ciVal = ci ? (ci.actual ?? ci.forecast) : null;
export const ci_value = typeof ciVal === "number" ? String(ciVal) : "--";
export const ci_index = ci ? ci.index.toUpperCase() : "NO DATA";
export const ci_col = (ci && INDEX_COL[ci.index]) || "#808080";

// Generation mix, largest first
let mix = [];
try {
  const r = await get(API + "/generation", { cache: CACHE });
  mix = r.data.generationmix.filter((m) => FUELS[m.fuel]);
} catch (e) {}
mix.sort((a, b) => b.perc - a.perc);
const top = Math.max(50, ...mix.map((m) => m.perc));
const v = {};
for (let i = 0; i < ROWS; i++) {
  const m = mix[i];
  const f = m ? FUELS[m.fuel] : null;
  v["f" + (i + 1) + "_name"] = f ? f.name : "";
  v["f" + (i + 1) + "_col"] = f ? f.col : "#000000";
  v["f" + (i + 1) + "_pct"] = m ? Math.round(m.perc) + "%" : "";
  v["f" + (i + 1) + "_w"] = m ? Math.round((m.perc / top) * BAR_MAX) : 0;
}
export const f1_name = v.f1_name, f1_col = v.f1_col, f1_pct = v.f1_pct, f1_w = v.f1_w;
export const f2_name = v.f2_name, f2_col = v.f2_col, f2_pct = v.f2_pct, f2_w = v.f2_w;
export const f3_name = v.f3_name, f3_col = v.f3_col, f3_pct = v.f3_pct, f3_w = v.f3_w;
export const f4_name = v.f4_name, f4_col = v.f4_col, f4_pct = v.f4_pct, f4_w = v.f4_w;
export const f5_name = v.f5_name, f5_col = v.f5_col, f5_pct = v.f5_pct, f5_w = v.f5_w;
export const f6_name = v.f6_name, f6_col = v.f6_col, f6_pct = v.f6_pct, f6_w = v.f6_w;
export const f7_name = v.f7_name, f7_col = v.f7_col, f7_pct = v.f7_pct, f7_w = v.f7_w;
export const f8_name = v.f8_name, f8_col = v.f8_col, f8_pct = v.f8_pct, f8_w = v.f8_w;
const clean = mix.filter((m) => LOW_CARBON.includes(m.fuel)).reduce((s, m) => s + m.perc, 0);
export const clean_pct = mix.length ? Math.round(clean) + "%" : "--";

// Cleanest upcoming half hour. The URL is rounded down to the half hour so the cache works.
let best = null;
try {
  const slot = new Date(Math.floor(nowMs / 1800000) * 1800000).toISOString().slice(0, 16) + "Z";
  const r = await get(API + "/intensity/" + slot + "/fw24h", { cache: CACHE });
  for (const s of r.data) {
    const end = Date.parse(s.to);
    if (!(end > nowMs) || typeof s.intensity.forecast !== "number") continue;
    if (!best || s.intensity.forecast < best.intensity.forecast) best = s;
  }
} catch (e) {}
let when = "--";
if (best) {
  const from = Date.parse(best.from);
  if (from <= nowMs) when = "Now";
  else {
    const t = uk(from).d;
    const day = t.getUTCDate() === here.d.getUTCDate() ? "Today" : DAYS[t.getUTCDay()];
    when = day + " " + hhmm(t);
  }
}
export const best_when = when;
export const best_value = best ? String(best.intensity.forecast) : "";
export const best_unit = best ? "g/kWh" : "";
export const best_col = (best && INDEX_COL[best.intensity.index]) || "#808080";
`;

const BG = "#000000";
const PANEL = "#141A24";
const MUTED = "#9AA6B8";
const MIX_Y = 34; // top of the first mix row
const MIX_STEP = 20;

const gridWire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, PANEL],
  ["text", "UK GRID", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", MUTED],
  // Current intensity, coloured by its index
  ["text", "NOW", 62, 36, 1, 1, "TC", MUTED],
  ["text", "{ci_value}", 62, 48, 4, 2, "TC", "{ci_col}"],
  ["text", "gCO2/kWh", 62, 102, 2, 1, "TC", MUTED],
  ["fillRoundRect", 10, 122, 104, 24, 12, "{ci_col}"],
  ["text", "{ci_index}", 62, 134, 2, 1, "MC", "#000000"],
  ["text", "LOW CARBON", 62, 158, 1, 1, "TC", MUTED],
  ["text", "{clean_pct}", 62, 168, 4, 1, "TC", "#00D26A"],
  // Generation mix: name, bar on a track, percentage
  ["drawFastVLine", 124, 34, 154, "#2A3342"],
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n): RawWireOp[] => {
    const y = MIX_Y + (n - 1) * MIX_STEP;
    return [
      ["text", `{f${n}_name}`, 132, y + 8, 2, 1, "ML", "#E6EAF0"],
      ["fillRect", 188, y + 3, 88, 11, "#222A36"],
      ["fillRect", 188, y + 3, `{f${n}_w}`, 11, `{f${n}_col}`],
      ["text", `{f${n}_pct}`, 312, y + 8, 2, 1, "MR", "#FFFFFF"],
    ];
  }),
  // Best upcoming half hour
  ["fillRoundRect", 6, 198, 308, 38, 8, PANEL],
  ["text", "BEST", 16, 209, 1, 1, "ML", MUTED],
  ["text", "TIME", 16, 222, 1, 1, "ML", MUTED],
  ["text", "{best_when}", 50, 218, 4, 1, "ML", "#FFFFFF"],
  ["text", "{best_value}", 268, 218, 4, 1, "MR", "{best_col}"],
  ["text", "{best_unit}", 272, 220, 1, 1, "ML", MUTED],
];

const template: Template = {
  id: "grid-carbon-uk",
  name: "UK grid carbon",
  description: "UK electricity carbon intensity coloured by its index, the generation mix by fuel, and the cleanest half hour ahead.",
  apis: ["Carbon Intensity API"],
  category: "science",
  dataCode: gridCode,
  rows: rows("grid-carbon-uk", gridWire),
  sampleVars: {"best_col": "#FF8A3D", "best_unit": "g/kWh", "best_value": "202", "best_when": "Sat 11:00", "ci_col": "#FF8A3D", "ci_index": "HIGH", "ci_value": "208", "clean_pct": "38%", "clock": "13:58 GMT", "f1_col": "#FF8C42", "f1_name": "Gas", "f1_pct": "45%", "f1_w": 78, "f2_col": "#B0BEC5", "f2_name": "Imports", "f2_pct": "15%", "f2_w": 27, "f3_col": "#B388FF", "f3_name": "Nuclear", "f3_pct": "13%", "f3_w": 22, "f4_col": "#4FC3F7", "f4_name": "Wind", "f4_pct": "9%", "f4_w": 15, "f5_col": "#FFD54F", "f5_name": "Solar", "f5_pct": "8%", "f5_w": 14, "f6_col": "#7CB342", "f6_name": "Biomass", "f6_pct": "8%", "f6_w": 13, "f7_col": "#2E8BFF", "f7_name": "Hydro", "f7_pct": "1%", "f7_w": 2, "f8_col": "#A1887F", "f8_name": "Coal", "f8_pct": "0%", "f8_w": 0},
};

export default template;
