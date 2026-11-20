import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Sun arc: the sun's path across the sky as an arc over the horizon, with the sun drawn at
// its current place, sunrise and sunset at the ends and the daylight left in the middle.

// Arc geometry (half an ellipse over the horizon). Data and Draw both use these numbers.
const CX = 160;
const HY = 172; // horizon y
const RX = 124;
const RY = 112;
const SEG = 32; // arc segments
const pt = (i: number) => {
  const a = Math.PI * (1 - i / SEG);
  return [Math.round(CX + RX * Math.cos(a)), Math.round(HY - RY * Math.sin(a))];
};

const code = String.raw`// Today's sunrise and sunset from sunrise-sunset.org (free, no key; credit sunrise-sunset.org).
// Set PLACE, LAT, LON and TZ for your location; now() should use the same timezone.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";

const CX = ${CX}, HY = ${HY}, RX = ${RX}, RY = ${RY}, SEG = ${SEG}; // keep in step with Draw
const OFF = -100; // off-screen y hides the sun

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const place = PLACE + "  " + now("ddd") + " " + Number(now("DD")) + " " + MONTHS[Number(now("MM")) - 1];
export const clock = now("HH:mm");
const nowMin = Number(now("HH")) * 60 + Number(now("mm"));

// "2026-11-21T05:55:55+11:00" -> minutes after local midnight
function mins(iso) {
  const t = String(iso).slice(11, 19);
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + (Number(t.slice(6, 8)) >= 30 ? 1 : 0);
}
const pad = (n) => (n < 10 ? "0" : "") + n;
const hhmm = (m) => pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
const span = (m) => (m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + "m");

let rise = null, set = null, noon = null;
try {
  const r = await get(
    "https://api.sunrise-sunset.org/json?lat=" + LAT + "&lng=" + LON + "&formatted=0&date=" + now("YYYY-MM-DD") + "&tzid=" + TZ,
    { cache: 3600 },
  );
  if (r.status !== "OK") throw new Error("status " + r.status);
  rise = mins(r.results.sunrise);
  set = mins(r.results.sunset);
  noon = mins(r.results.solar_noon);
} catch (e) {
  console.log("sunrise-sunset failed:", e.message);
}
const ok = rise !== null && set > rise;

export const sunrise = ok ? hhmm(rise) : "--:--";
export const sunset = ok ? hhmm(set) : "--:--";
export const noon_txt = ok ? "NOON " + hhmm(noon) : "";
export const day_len = ok ? span(set - rise) : "--";

// Fraction of daylight gone: 0 at sunrise, 1 at sunset.
const up = ok && nowMin >= rise && nowMin <= set;
const frac = ok ? Math.min(1, Math.max(0, (nowMin - rise) / (set - rise))) : 0;
const ang = Math.PI * (1 - frac);
export const sun_x = up ? Math.round(CX + RX * Math.cos(ang)) : CX;
export const sun_y = up ? Math.round(HY - RY * Math.sin(ang)) : OFF;
const low = frac < 0.08 || frac > 0.92;
export const sun_col = low ? "#FF9030" : "#FFE040";
export const glow_col = low ? "#7A3810" : "#806010";

// Arc segments: travelled part bright, the rest dim.
const DONE = "#FFB020", TODO = "#4A3C1C";
const segs = {};
for (let i = 0; i < SEG; i++) segs["a" + i] = up && (i + 0.5) / SEG <= frac ? DONE : ok && nowMin > set ? DONE : TODO;
${Array.from({ length: SEG }, (_, i) => `export const a${i} = segs.a${i};`).join("\n")}

let st = "Sun times unavailable", sc = "#A0B0C8";
if (ok) {
  if (nowMin < rise) { st = "Sunrise in " + span(rise - nowMin); sc = "#FF9040"; }
  else if (nowMin <= set) { st = span(set - nowMin) + " daylight left"; sc = "#FFFFFF"; }
  else { st = "Sun set " + span(nowMin - set) + " ago"; sc = "#8CA0C8"; }
}
export const status = st;
export const status_col = sc;
`;

const BG = "#05070D";
const GROUND = "#141A26";
const LABEL = "#8A96B0";

const arcOps: RawWireOp[] = [];
for (let i = 0; i < SEG; i++) {
  const [x0, y0] = pt(i);
  const [x1, y1] = pt(i + 1);
  // Three offset lines give the arc some thickness.
  arcOps.push(["drawLine", x0, y0, x1, y1, `{a${i}}`]);
  arcOps.push(["drawLine", x0, y0 - 1, x1, y1 - 1, `{a${i}}`]);
  arcOps.push(["drawLine", x0, y0 + 1, x1, y1 + 1, `{a${i}}`]);
}

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 28, "#0C1A33"],
  ["text", "{place}", 8, 14, 2, 1, "ML", "#C8D4E8"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Sky arc and noon tick
  ...arcOps,
  ["drawFastVLine", CX, HY - RY + 5, 6, "#4A3C1C"],
  // Inside the arc: day length and solar noon
  ["text", "DAY LENGTH", CX, 104, 1, 1, "TC", LABEL],
  ["text", "{day_len}", CX, 116, 4, 1, "TC", "#FFFFFF"],
  ["text", "{noon_txt}", CX, 148, 1, 1, "TC", LABEL],
  // Sun with a glow ring
  ["fillCircle", "{sun_x}", "{sun_y}", 13, "{glow_col}"],
  ["fillCircle", "{sun_x}", "{sun_y}", 9, "{sun_col}"],
  // Ground and horizon (painted over the lower half of the sun at the ends)
  ["fillRect", 0, HY + 2, 320, 240 - HY - 2, GROUND],
  ["drawFastHLine", 0, HY + 2, 320, "#3A4660"],
  // Sunrise and sunset under the arc ends
  ["text", "SUNRISE", 8, HY + 10, 1, 1, "TL", "#FFB040"],
  ["text", "{sunrise}", 8, HY + 20, 4, 1, "TL", "#FFFFFF"],
  ["text", "SUNSET", 312, HY + 10, 1, 1, "TR", "#FF7050"],
  ["text", "{sunset}", 312, HY + 20, 4, 1, "TR", "#FFFFFF"],
  // Status in the middle
  ["text", "{status}", CX, HY + 24, 2, 1, "TC", "{status_col}"],
  ["text", "sunrise-sunset.org", CX, 232, 1, 1, "BC", "#4A5670"],
];

const template: Template = {
  id: "sun-arc",
  name: "Sun arc",
  description: "The sun drawn on its arc across the sky right now, with sunrise and sunset at the ends, day length and the daylight left.",
  apis: ["sunrise-sunset.org", "now()"],
  category: "space",
  dataCode: code,
  rows: rows("sun-arc", wire),
  sampleVars: {"a0":"#FFB020","a1":"#FFB020","a10":"#FFB020","a11":"#FFB020","a12":"#FFB020","a13":"#FFB020","a14":"#FFB020","a15":"#FFB020","a16":"#FFB020","a17":"#FFB020","a18":"#FFB020","a19":"#FFB020","a2":"#FFB020","a20":"#FFB020","a21":"#4A3C1C","a22":"#4A3C1C","a23":"#4A3C1C","a24":"#4A3C1C","a25":"#4A3C1C","a26":"#4A3C1C","a27":"#4A3C1C","a28":"#4A3C1C","a29":"#4A3C1C","a3":"#FFB020","a30":"#4A3C1C","a31":"#4A3C1C","a4":"#FFB020","a5":"#FFB020","a6":"#FFB020","a7":"#FFB020","a8":"#FFB020","a9":"#FFB020","clock":"15:15","day_len":"14h 18m","glow_col":"#806010","noon_txt":"NOON 13:06","place":"MELBOURNE  Fri 20 Nov","status":"5h 0m daylight left","status_col":"#FFFFFF","sun_col":"#FFE040","sun_x":216,"sun_y":72,"sunrise":"05:57","sunset":"20:15"},
};

export default template;
