import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// Today's forecast high next to the actual high on the same date last year,
// with how much warmer or cooler it is and the rain for both days.
// Data from Open-Meteo forecast + historical archive (free, no key).
// Set PLACE, LAT and LON to your location.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const loc = "?latitude=" + LAT + "&longitude=" + LON + "&daily=temperature_2m_max,precipitation_sum&timezone=auto";

function first(d, key) {
  const v = d && d[key] ? d[key][0] : null;
  return typeof v === "number" ? v : null;
}

// Today's forecast. Its date is in the location's own timezone.
let todayHi = null;
let todayRain = null;
let today = now("YYYY-MM-DD");
try {
  const f = await get("https://api.open-meteo.com/v1/forecast" + loc + "&forecast_days=1", { cache: 3600 });
  todayHi = first(f.daily, "temperature_2m_max");
  todayRain = first(f.daily, "precipitation_sum");
  if (f.daily && f.daily.time && f.daily.time[0]) today = f.daily.time[0];
} catch (e) {
  console.log("weather-vs-last-year forecast: " + e);
}

// The same date a year ago (29 Feb becomes 28 Feb).
const parts = today.split("-");
const year = Number(parts[0]) - 1;
const month = parts[1];
let day = parts[2];
if (month === "02" && day === "29") day = "28";
const past = year + "-" + month + "-" + day;

let pastHi = null;
let pastRain = null;
try {
  const a = await get(
    "https://archive-api.open-meteo.com/v1/archive" + loc + "&start_date=" + past + "&end_date=" + past,
    { cache: 86400 },
  );
  pastHi = first(a.daily, "temperature_2m_max");
  pastRain = first(a.daily, "precipitation_sum");
} catch (e) {
  console.log("weather-vs-last-year archive: " + e);
}

const dayLabel = Number(day) + " " + MONTHS[Number(month) - 1];

export const place = PLACE;
export const clock = now("ddd HH:mm");
export const left_sub = dayLabel + " " + (year + 1);
export const right_lbl = String(year);
export const right_sub = dayLabel + " " + year;

// Big numbers: font 4 at size 2, with a drawn degree ring after them.
function width(s) {
  let w = 0;
  for (const ch of s) w += ch === "-" ? 16 : ch === "." ? 14 : 28;
  return w;
}
function big(v, cx) {
  const s = v === null ? "--" : v.toFixed(1);
  const w = width(s);
  const x = Math.round(cx - (w + 12) / 2);
  return { s: s, x: x, ring: v === null ? -100 : x + w + 7 };
}
const L = big(todayHi, 82);
const R = big(pastHi, 238);
export const t_now = L.s;
export const t_now_x = L.x;
export const ring_now_x = L.ring;
export const t_past = R.s;
export const t_past_x = R.x;
export const ring_past_x = R.ring;

function rain(v) {
  if (v === null) return "Rain --";
  if (v < 0.1) return "Dry";
  return "Rain " + v.toFixed(1) + " mm";
}
export const rain_now = rain(todayRain);
export const rain_past = rain(pastRain);

// Delta banner. Arrow points up (warmer, red) or down (cooler, blue).
const ok = todayHi !== null && pastHi !== null;
const diff = ok ? Math.round((todayHi - pastHi) * 10) / 10 : 0;
const OFF = -200;
let tri = [OFF, OFF, OFF, OFF, OFF, OFF];
let panel = "#2A2F36";
let arrow = "#9AA4AE";
let msg = "No comparison";
if (ok && diff >= 0.5) {
  panel = "#5A1E16";
  arrow = "#FF6A4D";
  msg = "+" + diff.toFixed(1) + "C warmer";
  tri = [40, 176, 22, 208, 58, 208];
} else if (ok && diff <= -0.5) {
  panel = "#14325A";
  arrow = "#5AB0FF";
  msg = diff.toFixed(1) + "C cooler";
  tri = [22, 178, 58, 178, 40, 210];
} else if (ok) {
  msg = "About the same";
}
export const panel_col = panel;
export const arrow_col = arrow;
export const delta = msg;
export const delta_x = tri[0] === OFF ? 160 : 182; // centre the text when there is no arrow
export const ax1 = tri[0];
export const ay1 = tri[1];
export const ax2 = tri[2];
export const ay2 = tri[3];
export const ax3 = tri[4];
export const ay3 = tri[5];

let wet = "";
if (todayRain !== null && pastRain !== null) {
  const dr = todayRain - pastRain;
  if (dr >= 1) wet = "and wetter";
  else if (dr <= -1) wet = "and drier";
  else wet = "similar rain";
}
export const delta_sub = ok ? (wet ? wet + ", vs " + dayLabel + " " + year : "vs " + dayLabel + " " + year) : "";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#0B1118"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#18232F"],
  ["text", "{place}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#B8C2CC"],
  // Columns
  ["drawFastVLine", 160, 36, 108, "#2E3A46"],
  ["text", "TODAY", 82, 42, 2, 1, "MC", "#FFB347"],
  ["text", "{left_sub}", 82, 58, 1, 1, "MC", "#8A96A2"],
  ["text", "{right_lbl}", 238, 42, 2, 1, "MC", "#B8C2CC"],
  ["text", "{right_sub}", 238, 58, 1, 1, "MC", "#8A96A2"],
  // Big highs
  ["text", "{t_now}", "{t_now_x}", 70, 4, 2, "TL", "#FFFFFF"],
  ["drawCircle", "{ring_now_x}", 80, 5, "#FFFFFF"],
  ["drawCircle", "{ring_now_x}", 80, 4, "#FFFFFF"],
  ["text", "{t_past}", "{t_past_x}", 70, 4, 2, "TL", "#C8D0D8"],
  ["drawCircle", "{ring_past_x}", 80, 5, "#C8D0D8"],
  ["drawCircle", "{ring_past_x}", 80, 4, "#C8D0D8"],
  ["text", "MAX", 82, 128, 1, 1, "MC", "#6E7A86"],
  ["text", "MAX", 238, 128, 1, 1, "MC", "#6E7A86"],
  // Rain
  ["text", "{rain_now}", 82, 142, 2, 1, "MC", "#7FC8FF"],
  ["text", "{rain_past}", 238, 142, 2, 1, "MC", "#7FC8FF"],
  // Delta banner
  ["fillRoundRect", 8, 160, 304, 68, 8, "{panel_col}"],
  ["fillTriangle", "{ax1}", "{ay1}", "{ax2}", "{ay2}", "{ax3}", "{ay3}", "{arrow_col}"],
  ["text", "{delta}", "{delta_x}", 184, 4, 1, "MC", "#FFFFFF"],
  ["text", "{delta_sub}", "{delta_x}", 210, 2, 1, "MC", "#D8DEE4"],
];

const template: Template = {
  id: "weather-vs-last-year",
  name: "Today vs a year ago",
  description: "Today's forecast high beside the actual high on the same date last year, with how much warmer or cooler it is and the rain for both.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("weather-vs-last-year", wire),
  sampleVars: {
    arrow_col: "#FF6A4D",
    ax1: 40,
    ax2: 22,
    ax3: 58,
    ay1: 176,
    ay2: 208,
    ay3: 208,
    clock: "Sat 13:26",
    delta: "+5.3C warmer",
    delta_sub: "and wetter, vs 21 Nov 2025",
    delta_x: 182,
    left_sub: "21 Nov 2026",
    panel_col: "#5A1E16",
    place: "MELBOURNE",
    rain_now: "Rain 2.3 mm",
    rain_past: "Dry",
    right_lbl: "2025",
    right_sub: "21 Nov 2025",
    ring_now_x: 132,
    ring_past_x: 288,
    t_now: "23.8",
    t_now_x: 27,
    t_past: "18.5",
    t_past_x: 183,
  },
};

export default template;
