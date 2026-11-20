import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Morning briefing

const code = String.raw`// A morning dashboard: greeting, date and time, today's weather, sunrise and sunset,
// and the ZenQuotes quote of the day. Weather from Open-Meteo, quote from ZenQuotes (both keyless).
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";
const WRAP_PX = 304; // quote width in px (font 2)
const HIDE = -200;   // y for icon parts that should not show

// ---- Greeting, date and time ----
const hour = Number(now("HH"));
export const greeting =
  hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const date = now("ddd") + " " + Number(now("DD")) + " " + MONTHS[Number(now("MM")) - 1];
export const time = now("HH:mm");

// ---- Weather and sun times ----
let wx = null;
try {
  wx = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
      "&timezone=" + encodeURIComponent(TZ) + "&forecast_days=1",
    { cache: 900 },
  );
} catch (e) {
  console.log("open-meteo failed:", e.message);
}
const ok = !!(wx && wx.current && wx.daily);
const wcode = ok ? wx.current.weather_code : -1;

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
const round = (v) => (typeof v === "number" ? String(Math.round(v)) : "--");
const hhmm = (iso) => (typeof iso === "string" && iso.length >= 16 ? iso.slice(11, 16) : "--:--");

const t = ok ? Math.round(wx.current.temperature_2m) : null;
export const temp = t === null ? "--" : String(t);
export const temp_col = t === null ? "#A0A0A0" : t < 10 ? "#80B4FF" : t < 20 ? "#FFFFFF" : t < 28 ? "#FFC040" : "#FF6040";
export const cond = ok ? describe(wcode) : "No weather";
export const high = ok ? round(wx.daily.temperature_2m_max[0]) : "--";
export const low = ok ? round(wx.daily.temperature_2m_min[0]) : "--";
export const rain = ok && typeof wx.daily.precipitation_probability_max[0] === "number"
  ? wx.daily.precipitation_probability_max[0] + "%" : "--";
export const sunrise = ok ? hhmm(wx.daily.sunrise[0]) : "--:--";
export const sunset = ok ? hhmm(wx.daily.sunset[0]) : "--:--";

// Icon: sun, sun behind cloud, cloud, or cloud with drops (rain cyan, snow white, storm yellow).
const drops = (wcode >= 51 && wcode <= 67) || (wcode >= 71 && wcode <= 86) || wcode >= 95;
export const ic_sun_y = wcode === 0 ? 62 : HIDE;
export const ic_psun_y = wcode === 1 || wcode === 2 ? 50 : HIDE;
export const ic_cloud_y = wcode > 0 ? (drops ? 52 : 58) : HIDE;
export const ic_cloud = wcode === 45 || wcode === 48 || drops ? "#C8C8C8" : "#FFFFFF";
export const ic_drop_y = drops ? 74 : HIDE;
export const ic_drop = wcode >= 95 ? "#FFFF00" : wcode >= 71 && wcode <= 86 && !(wcode >= 80 && wcode <= 82) ? "#FFFFFF" : "#00C8FF";

// ---- Quote of the day ----
let q = "The best way to predict the future is to create it.";
let author = "Peter Drucker";
try {
  const res = await get("https://zenquotes.io/api/today", { cache: 21600 });
  if (Array.isArray(res) && res[0] && res[0].q) {
    q = res[0].q;
    author = res[0].a || "Unknown";
  }
} catch (e) {
  console.log("zenquotes failed:", e.message);
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();

// Font 2 glyph widths (char code - 32), so the wrap fits the screen exactly.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const px = (s) => { let w = 0; for (let i = 0; i < s.length; i++) w += W[s.charCodeAt(i) - 32] || 6; return w; };

const words = ascii(q).split(/\s+/).filter(Boolean);
const lines = [];
let line = "";
for (const w of words) {
  const next = line ? line + " " + w : w;
  if (line && px(next) > WRAP_PX) { lines.push(line); line = w; }
  else line = next;
}
if (line) lines.push(line);
if (lines.length > 2) {
  let l2 = lines[1];
  while (l2.length > 0 && px(l2 + "...") > WRAP_PX) l2 = l2.slice(0, -1);
  lines.length = 2;
  lines[1] = l2.replace(/[\s,.;:]+$/, "") + "...";
}
export const q1 = lines[0] || "";
export const q2 = lines[1] || "";
export const q_author = "- " + ascii(author);
`;

const BG = "#000000";
const CARD = "#18283C";
const LABEL = "#A0B0C8";
const ACCENT = "#FFB040";
const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: greeting and date
  ["fillRect", 0, 0, 320, 28, "#2A1E08"],
  ["text", "{greeting}", 8, 14, 2, 1, "ML", ACCENT],
  ["text", "{date}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Left: big time, place, sunrise and sunset
  ["text", "{time}", 8, 36, 4, 2, "TL", "#FFFFFF"],
  ["fillTriangle", 8, 101, 14, 93, 20, 101, "#FFB040"],
  ["text", "{sunrise}", 25, 90, 2, 1, "TL", "#FFFFFF"],
  ["fillTriangle", 80, 93, 86, 101, 92, 93, "#FF7050"],
  ["text", "{sunset}", 97, 90, 2, 1, "TL", "#FFFFFF"],
  // Right: weather card with icon and temperature
  ["fillRoundRect", 158, 34, 154, 76, 6, CARD],
  ["fillCircle", 196, "{ic_sun_y}", 18, "#FFC800"],
  ["fillCircle", 182, "{ic_psun_y}", 11, "#FFC800"],
  ["fillCircle", 186, "{ic_cloud_y}", 10, "{ic_cloud}"],
  ["fillCircle", 202, "{ic_cloud_y}", 13, "{ic_cloud}"],
  ["fillRoundRect", 170, "{ic_cloud_y}", 52, 16, 8, "{ic_cloud}"],
  ["fillRect", 180, "{ic_drop_y}", 2, 8, "{ic_drop}"],
  ["fillRect", 192, "{ic_drop_y}", 2, 8, "{ic_drop}"],
  ["fillRect", 204, "{ic_drop_y}", 2, 8, "{ic_drop}"],
  ["fillRect", 216, "{ic_drop_y}", 2, 8, "{ic_drop}"],
  ["text", "{temp}", 290, 38, 4, 2, "TR", "{temp_col}"],
  ["drawCircle", 298, 46, 4, "{temp_col}"],
  ["drawCircle", 298, 46, 3, "{temp_col}"],
  ["text", "{cond}", 235, 90, 2, 1, "TC", "#D0D8E4"],
  // Cards: max, min, rain chance
  ["fillRoundRect", 8, 116, 94, 48, 6, CARD],
  ["fillRoundRect", 113, 116, 94, 48, 6, CARD],
  ["fillRoundRect", 218, 116, 94, 48, 6, CARD],
  ["text", "MAX (C)", 55, 122, 1, 1, "TC", LABEL],
  ["text", "MIN (C)", 160, 122, 1, 1, "TC", LABEL],
  ["text", "RAIN CHANCE", 265, 122, 1, 1, "TC", LABEL],
  ["text", "{high}", 55, 134, 4, 1, "TC", "#FFC040"],
  ["text", "{low}", 160, 134, 4, 1, "TC", "#80B4FF"],
  ["text", "{rain}", 265, 134, 4, 1, "TC", "#00C8FF"],
  // Quote of the day
  ["drawFastHLine", 8, 172, 304, "#3A3020"],
  ["text", "{q1}", 8, 178, 2, 1, "TL", "#FFFFFF"],
  ["text", "{q2}", 8, 196, 2, 1, "TL", "#FFFFFF"],
  ["text", "{q_author}", 8, 220, 1, 1, "TL", ACCENT],
  ["text", "Quotes by zenquotes.io", 312, 220, 1, 1, "TR", "#606060"],
];

const template: Template = {
  id: "morning-briefing",
  name: "Morning briefing",
  description: "A greeting with the date and time, today's Melbourne weather, sunrise and sunset, and the quote of the day.",
  apis: ["Open-Meteo", "ZenQuotes"],
  category: "clocks",
  dataCode: code,
  rows: rows("morning-briefing", wire),
  sampleVars: {"cond":"Clear","date":"Sat 21 Nov","greeting":"Good morning","high":"24","ic_cloud":"#FFFFFF","ic_cloud_y":-200,"ic_drop":"#00C8FF","ic_drop_y":-200,"ic_psun_y":-200,"ic_sun_y":62,"low":"17","q1":"The best way to predict the future is to create","q2":"it.","q_author":"- Peter Drucker","rain":"76%","sunrise":"05:56","sunset":"20:16","temp":"20","temp_col":"#FFC040","time":"07:30"},
};

export default template;
