import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// The current temperature, huge, on a background that runs from blue (cold) to red (hot).
// Data from Open-Meteo (free, no key). Set PLACE, LAT and LON to your location.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;

let c = null;
let d = null;
try {
  const wx = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,apparent_temperature,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto",
    { cache: 600 },
  );
  c = wx.current;
  d = wx.daily;
} catch (e) {
  console.log("big-temp: " + e);
}

function describe(n) {
  if (n === 0) return "Clear";
  if (n === 1) return "Mostly clear";
  if (n === 2) return "Partly cloudy";
  if (n === 3) return "Overcast";
  if (n === 45 || n === 48) return "Fog";
  if (n >= 51 && n <= 57) return "Drizzle";
  if (n >= 61 && n <= 67) return "Rain";
  if (n >= 71 && n <= 77) return "Snow";
  if (n >= 80 && n <= 82) return "Showers";
  if (n === 85 || n === 86) return "Snow showers";
  if (n >= 95) return "Thunderstorm";
  return "";
}

// Background colour stops: temperature (C) -> RGB.
const STOPS = [
  [0, [30, 58, 138]],
  [10, [29, 100, 176]],
  [16, [16, 130, 140]],
  [21, [40, 135, 80]],
  [26, [200, 120, 20]],
  [31, [200, 65, 12]],
  [36, [150, 25, 25]],
];
function mix(t) {
  if (t <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      return [0, 1, 2].map((k) => Math.round(a[1][k] + (b[1][k] - a[1][k]) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
function hex(rgb, scale) {
  return "#" + rgb.map((v) => {
    const s = Math.max(0, Math.min(255, Math.round(v * scale))).toString(16).toUpperCase();
    return s.length < 2 ? "0" + s : s;
  }).join("");
}

const ok = c !== null && typeof c.temperature_2m === "number";
const t = ok ? Math.round(c.temperature_2m) : null;
const rgb = ok ? mix(c.temperature_2m) : [60, 60, 60];

export const place = PLACE;
export const clock = now("ddd HH:mm");
export const bg = hex(rgb, 1);
export const hdr = hex(rgb, 0.55);

// Centre the number and its degree ring together. Font 4 at size 4: digits 56 px, minus 32 px.
export const temp = ok ? String(t) : "--";
let w = 0;
for (const ch of temp) w += ch === "-" ? 32 : 56;
const left = Math.round(160 - (w + 30) / 2);
export const temp_x = left;
export const ring_x = ok ? left + w + 18 : -100; // hide the ring when there is no data

export const cond = ok ? describe(c.weather_code) : "No data";
const feels = ok && typeof c.apparent_temperature === "number" ? Math.round(c.apparent_temperature) : null;
const lo = d && d.temperature_2m_min ? d.temperature_2m_min[0] : null;
const hi = d && d.temperature_2m_max ? d.temperature_2m_max[0] : null;
export const feels_txt = feels === null ? "" : "Feels " + feels;
export const range_txt = lo === null || hi === null ? "" : "Low " + Math.round(lo) + "   High " + Math.round(hi);
`;

const wire: RawWireOp[] = [
  ["fillScreen", "{bg}"],
  // Header
  ["fillRect", 0, 0, 320, 26, "{hdr}"],
  ["text", "{place}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#E0E0E0"],
  // Giant temperature with a drawn degree ring
  ["text", "{temp}", "{temp_x}", 40, 4, 4, "TL", "#FFFFFF"],
  ["drawCircle", "{ring_x}", 58, 10, "#FFFFFF"],
  ["drawCircle", "{ring_x}", 58, 9, "#FFFFFF"],
  ["drawCircle", "{ring_x}", 58, 8, "#FFFFFF"],
  // Condition and details
  ["text", "{cond}", 160, 158, 4, 1, "MC", "#FFFFFF"],
  ["drawFastHLine", 60, 177, 200, "#FFFFFF"],
  ["text", "{feels_txt}", 160, 195, 2, 1, "MC", "#F0F0F0"],
  ["text", "{range_txt}", 160, 216, 2, 1, "MC", "#F0F0F0"],
];

const template: Template = {
  id: "big-temp",
  name: "Giant temperature",
  description: "The current temperature in huge digits on a background that shifts from blue to red as it warms.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("big-temp", wire),
  sampleVars: {
    bg: "#218662",
    clock: "Sat 13:12",
    cond: "Clear",
    feels_txt: "Feels 20",
    hdr: "#124A36",
    place: "MELBOURNE",
    range_txt: "Low 17   High 24",
    ring_x: 219,
    temp: "20",
    temp_x: 89,
  },
};

export default template;
