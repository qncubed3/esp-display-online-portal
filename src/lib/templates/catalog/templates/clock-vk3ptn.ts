import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Clock (vk3ptn): port of https://github.com/vk3ptn/Clock (Clock.ino v1.0.4)
//
// The original draws the time in TFT_eSPI font 7 (7-segment digits, 48 px tall), which our ops
// don't offer, so each digit is built from seven fillRects whose colours come from Data
// (lit = cyan, unlit = black). Segments never overlap, so unlit ones can't erase lit ones.
// Weather icons are the original's shapes at the original coordinates; each icon's y values are
// variables that Data moves 400 px off screen when that icon isn't the current one.

const vk3Code = String.raw`// Internet clock + weather observation.
// Port of github.com/vk3ptn/Clock (Clock.ino) by Phuong Nguyen (VK3PTN).
// Set LAT / LON for the weather location. now() uses your account's timezone.
const LAT = -37.8676; // Altona, VIC
const LON = 144.83;

// ---- Time: 12-hour HH:MM with AM/PM, drawn as 7-segment digits
const h24 = Number(now("HH"));
const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
const digits = (h12 < 10 ? "0" + h12 : String(h12)) + now("mm");
export const ampm = h24 >= 12 ? "PM" : "AM";
export const date = now("ddd DD/MM/YYYY");

const LIT = "#00FFFF"; // cyan, like the original
const OFF = "#000000"; // try "#002828" for faint unlit segments
const SEGMENTS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const seg = (i, s) => (SEGMENTS[Number(digits[i])].includes(s) ? LIT : OFF);
export const h1_a = seg(0, "a"), h1_b = seg(0, "b"), h1_c = seg(0, "c"), h1_d = seg(0, "d"), h1_e = seg(0, "e"), h1_f = seg(0, "f"), h1_g = seg(0, "g");
export const h2_a = seg(1, "a"), h2_b = seg(1, "b"), h2_c = seg(1, "c"), h2_d = seg(1, "d"), h2_e = seg(1, "e"), h2_f = seg(1, "f"), h2_g = seg(1, "g");
export const m1_a = seg(2, "a"), m1_b = seg(2, "b"), m1_c = seg(2, "c"), m1_d = seg(2, "d"), m1_e = seg(2, "e"), m1_f = seg(2, "f"), m1_g = seg(2, "g");
export const m2_a = seg(3, "a"), m2_b = seg(3, "b"), m2_c = seg(3, "c"), m2_d = seg(3, "d"), m2_e = seg(3, "e"), m2_f = seg(3, "f"), m2_g = seg(3, "g");

// ---- Weather (Open-Meteo, refreshed every 10 minutes like the original)
let cur = null;
try {
  const wx = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
      "&temperature_unit=celsius&wind_speed_unit=kmh&timezone=Australia%2FMelbourne",
    { cache: 600 },
  );
  cur = wx.current;
} catch (e) {
  console.log("weather failed:", e.message); // the bottom row stays blank, as in the original
}
const code = cur ? cur.weather_code : -1;

function describe(c) {
  if (c === 0) return " Clear";
  if (c >= 1 && c <= 3) return "Cloudy";
  if (c >= 45 && c <= 48) return " Foggy";
  if (c >= 51 && c <= 55) return "Drizzle";
  if (c >= 61 && c <= 65) return " Rain";
  if (c >= 71 && c <= 75) return " Snow";
  if (c >= 80 && c <= 82) return "Showers";
  if (c >= 95 && c <= 99) return " Storm";
  return "Stable";
}
function compass(d) {
  if (d >= 338 || d < 23) return "N";
  if (d < 68) return "NE";
  if (d < 113) return "E";
  if (d < 158) return "SE";
  if (d < 203) return "S";
  if (d < 248) return "SW";
  if (d < 293) return "W";
  return "NW";
}

export const temp = cur ? cur.temperature_2m.toFixed(1) : "";
// The original puts the degree ring 10 px per char of the 2-decimal value ("19.60") after x 65.
const degX = 65 + (cur ? cur.temperature_2m.toFixed(2).length * 10 : 0) + 4;
export const deg_x = degX;
export const deg_c_x = degX + 5;
export const deg_col = cur ? "#FFFF00" : "#000000";
export const deg_c = cur ? "c" : "";
export const cond = cur ? describe(code) : "";
export const humidity = cur ? cur.relative_humidity_2m + "% RH" : "";
export const wind = cur ? Math.round(cur.wind_speed_10m) + " Km/h " + compass(cur.wind_direction_10m) : "";

// ---- Icon: each value is a y coordinate used by that icon's shapes in Draw;
// icons that aren't current are moved 400 px up, off screen.
const ICON = !cur ? "" : code === 0 ? "sun" : code <= 3 ? "cloud"
  : (code >= 51 && code <= 65) || (code >= 80 && code <= 82) ? "rain"
  : code >= 95 && code <= 99 ? "storm" : "fog";
const at = (icon, y) => (ICON === icon ? y : y - 400);
export const sun_y177 = at("sun", 177), sun_y182 = at("sun", 182), sun_y185 = at("sun", 185), sun_y195 = at("sun", 195);
export const sun_y204 = at("sun", 204), sun_y207 = at("sun", 207), sun_y212 = at("sun", 212);
export const cloud_y195 = at("cloud", 195), cloud_y199 = at("cloud", 199), cloud_y200 = at("cloud", 200), cloud_y203 = at("cloud", 203);
export const rain_y191 = at("rain", 191), rain_y195 = at("rain", 195), rain_y197 = at("rain", 197), rain_y204 = at("rain", 204), rain_y210 = at("rain", 210);
export const storm_y190 = at("storm", 190), storm_y197 = at("storm", 197), storm_y205 = at("storm", 205), storm_y213 = at("storm", 213);
export const fog_y193 = at("fog", 193), fog_y198 = at("fog", 198), fog_y203 = at("fog", 203);
`;

// One 7-segment digit in a 32 px font-7 cell at (x, 30): segments a-g, 5 px thick, 48 px tall.
function segDigit(name: string, x: number): RawWireOp[] {
  const L = x + 3, R = x + 24, T = 30, t = 5, w = 16;
  return [
    ["fillRect", L + t, T, w, t, `{${name}_a}`],
    ["fillRect", R, T + 3, t, 19, `{${name}_b}`],
    ["fillRect", R, T + 26, t, 19, `{${name}_c}`],
    ["fillRect", L + t, T + 43, w, t, `{${name}_d}`],
    ["fillRect", L, T + 26, t, 19, `{${name}_e}`],
    ["fillRect", L, T + 3, t, 19, `{${name}_f}`],
    ["fillRect", L + t, T + 21, w, t, `{${name}_g}`],
  ];
}

const vk3Wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["drawFastHLine", 10, 158, 300, "#808080"],
  // Time "HH:MM" centred near x 140 (font 7 cells: 32 px digits, 12 px colon), AM/PM after it
  ...segDigit("h1", 64),
  ...segDigit("h2", 96),
  ["fillRect", 132, 44, 5, 5, "#00FFFF"],
  ["fillRect", 132, 62, 5, 5, "#00FFFF"],
  ...segDigit("m1", 140),
  ...segDigit("m2", 172),
  ["setTextSize", 1],
  ["setTextColor", "#00FFFF"],
  ["setTextDatum", "TL"],
  ["drawString", "{ampm}", 220, 35, 4],
  // Date
  ["setTextColor", "#FFFFFF"],
  ["setTextDatum", "TC"],
  ["drawString", "{date}", 160, 110, 4],
  // Weather icon (origin 12,175): sun
  ["fillCircle", 32, "{sun_y195}", 10, "#FFFF00"],
  ["drawLine", 45, "{sun_y195}", 50, "{sun_y195}", "#FFFF00"],
  ["drawLine", 41, "{sun_y204}", 44, "{sun_y207}", "#FFFF00"],
  ["drawLine", 32, "{sun_y207}", 32, "{sun_y212}", "#FFFF00"],
  ["drawLine", 22, "{sun_y204}", 19, "{sun_y207}", "#FFFF00"],
  ["drawLine", 19, "{sun_y195}", 14, "{sun_y195}", "#FFFF00"],
  ["drawLine", 22, "{sun_y185}", 19, "{sun_y182}", "#FFFF00"],
  ["drawLine", 31, "{sun_y182}", 31, "{sun_y177}", "#FFFF00"],
  ["drawLine", 41, "{sun_y185}", 44, "{sun_y182}", "#FFFF00"],
  // cloudy
  ["fillCircle", 27, "{cloud_y199}", 8, "#808080"],
  ["fillCircle", 37, "{cloud_y195}", 10, "#FFFFFF"],
  ["fillCircle", 45, "{cloud_y200}", 7, "#FFFFFF"],
  ["fillRect", 27, "{cloud_y203}", 18, 5, "#FFFFFF"],
  // rain / showers
  ["fillCircle", 32, "{rain_y191}", 9, "#FFFFFF"],
  ["fillCircle", 40, "{rain_y195}", 7, "#FFFFFF"],
  ["fillCircle", 25, "{rain_y195}", 6, "#FFFFFF"],
  ["fillRect", 25, "{rain_y197}", 15, 5, "#FFFFFF"],
  ["drawLine", 27, "{rain_y204}", 24, "{rain_y210}", "#00FFFF"],
  ["drawLine", 34, "{rain_y204}", 31, "{rain_y210}", "#00FFFF"],
  ["drawLine", 41, "{rain_y204}", 38, "{rain_y210}", "#00FFFF"],
  // storm
  ["fillCircle", 32, "{storm_y190}", 9, "#808080"],
  ["drawLine", 34, "{storm_y197}", 26, "{storm_y205}", "#FF0000"],
  ["drawLine", 26, "{storm_y205}", 32, "{storm_y205}", "#FF0000"],
  ["drawLine", 32, "{storm_y205}", 27, "{storm_y213}", "#FF0000"],
  // fog / other
  ["drawFastHLine", 20, "{fog_y193}", 24, "#D3D3D3"],
  ["drawFastHLine", 17, "{fog_y198}", 30, "#D3D3D3"],
  ["drawFastHLine", 22, "{fog_y203}", 20, "#D3D3D3"],
  // Temperature with a drawn degree ring and "c"
  ["setTextDatum", "TL"],
  ["setTextColor", "#FFFF00"],
  ["drawString", "{temp}", 65, 172, 4],
  ["drawCircle", "{deg_x}", 176, 3, "{deg_col}"],
  ["drawString", "{deg_c}", "{deg_c_x}", 172, 4],
  ["setTextColor", "#00FF00"],
  ["drawString", "{cond}", 65, 205, 4],
  ["setTextColor", "#0000FF"],
  ["drawString", "{humidity}", 162, 172, 4],
  ["setTextColor", "#FF0000"],
  ["drawString", "{wind}", 162, 205, 4],
];

const template: Template = {
  id: "clock-vk3ptn",
  name: "Clock (vk3ptn)",
  description:
    "Port of github.com/vk3ptn/Clock: cyan 7-segment 12-hour clock with AM/PM, the date, and a weather row with icon, temperature, humidity and wind.",
  apis: ["now()", "Open-Meteo"],
  category: "clocks",
  dataCode: vk3Code,
  rows: rows("clock-vk3ptn", vk3Wire),
  sampleVars: {"ampm": "PM", "cloud_y195": 195, "cloud_y199": 199, "cloud_y200": 200, "cloud_y203": 203, "cond": "Cloudy", "date": "Fri 20/11/2026", "deg_c": "c", "deg_c_x": 124, "deg_col": "#FFFF00", "deg_x": 119, "fog_y193": -207, "fog_y198": -202, "fog_y203": -197, "h1_a": "#000000", "h1_b": "#00FFFF", "h1_c": "#00FFFF", "h1_d": "#000000", "h1_e": "#000000", "h1_f": "#000000", "h1_g": "#000000", "h2_a": "#000000", "h2_b": "#00FFFF", "h2_c": "#00FFFF", "h2_d": "#000000", "h2_e": "#000000", "h2_f": "#000000", "h2_g": "#000000", "humidity": "92% RH", "m1_a": "#00FFFF", "m1_b": "#00FFFF", "m1_c": "#00FFFF", "m1_d": "#00FFFF", "m1_e": "#00FFFF", "m1_f": "#00FFFF", "m1_g": "#000000", "m2_a": "#00FFFF", "m2_b": "#00FFFF", "m2_c": "#00FFFF", "m2_d": "#00FFFF", "m2_e": "#000000", "m2_f": "#000000", "m2_g": "#00FFFF", "rain_y191": -209, "rain_y195": -205, "rain_y197": -203, "rain_y204": -196, "rain_y210": -190, "storm_y190": -210, "storm_y197": -203, "storm_y205": -195, "storm_y213": -187, "sun_y177": -223, "sun_y182": -218, "sun_y185": -215, "sun_y195": -205, "sun_y204": -196, "sun_y207": -193, "sun_y212": -188, "temp": "19.5", "wind": "15 Km/h N"},
};

export default template;
