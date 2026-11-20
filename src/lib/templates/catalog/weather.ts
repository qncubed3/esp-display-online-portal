import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "./rows";
import type { Template } from "./types";

// Weather

const weatherCode = String.raw`// Current weather and today's range from Open-Meteo (free, no key).
// Set PLACE, LAT and LON to your location.
const PLACE = "MELBOURNE";
const LAT = -37.8136;
const LON = 144.9631;
const HIDE = -200; // y for icon parts that should not show

const wx = await get(
  "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1" +
    "&wind_speed_unit=kmh&timezone=Australia%2FMelbourne",
  { cache: 600 },
);
const c = wx.current;
const d = wx.daily;
const code = c.weather_code;

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
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export const place = PLACE;
export const clock = now("ddd HH:mm");

const t = Math.round(c.temperature_2m);
export const temp = String(t);
export const temp_col = t < 10 ? "#80B4FF" : t < 20 ? "#FFFFFF" : t < 28 ? "#FFC040" : "#FF6040";
export const cond = describe(code);
export const feels = "Feels like " + Math.round(c.apparent_temperature);

export const low = String(Math.round(d.temperature_2m_min[0]));
export const high = String(Math.round(d.temperature_2m_max[0]));
export const rain = (d.precipitation_probability_max[0] ?? 0) + "%";
export const wind = String(Math.round(c.wind_speed_10m));
export const wind_unit = "km/h " + DIRS[Math.round(c.wind_direction_10m / 45) % 8];

// Icon: sun, sun behind cloud, cloud, or cloud with drops (rain cyan, snow white, storm yellow).
const drops = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
export const ic_sun_y = code === 0 ? 92 : HIDE;
export const ic_psun_y = code === 1 || code === 2 ? 78 : HIDE;
export const ic_cloud_y = code > 0 ? (drops ? 92 : 100) : HIDE;
export const ic_cloud = code === 45 || code === 48 || drops ? "#D3D3D3" : "#FFFFFF";
export const ic_drop_y = drops ? 124 : HIDE;
export const ic_drop = code >= 95 ? "#FFFF00" : code >= 71 && code <= 86 && !(code >= 80 && code <= 82) ? "#FFFFFF" : "#00C8FF";
`;

const CARD = "#18283C";
const weatherWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 28, "#003366"],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 1],
  ["setTextDatum", "ML"],
  ["drawString", "{place}", 8, 14, 2],
  ["setTextColor", "#C0D0E0"],
  ["setTextDatum", "MR"],
  ["drawString", "{clock}", 312, 14, 2],
  // Icon
  ["fillCircle", 64, "{ic_sun_y}", 28, "#FFC800"],
  ["fillCircle", 50, "{ic_psun_y}", 18, "#FFC800"],
  ["fillCircle", 56, "{ic_cloud_y}", 16, "{ic_cloud}"],
  ["fillCircle", 84, "{ic_cloud_y}", 22, "{ic_cloud}"],
  ["fillRoundRect", 30, "{ic_cloud_y}", 86, 26, 13, "{ic_cloud}"],
  ["fillRect", 46, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  ["fillRect", 66, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  ["fillRect", 86, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  ["fillRect", 106, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  // Big temperature with a drawn degree ring
  ["setTextColor", "{temp_col}"],
  ["setTextDatum", "TR"],
  ["setTextSize", 2],
  ["drawString", "{temp}", 258, 44, 4],
  ["drawCircle", 266, 52, 5, "{temp_col}"],
  ["drawCircle", 266, 52, 4, "{temp_col}"],
  ["setTextSize", 1],
  ["setTextDatum", "TL"],
  ["drawString", "C", 275, 44, 4],
  ["setTextColor", "#FFFFFF"],
  ["setTextDatum", "TR"],
  ["drawString", "{cond}", 300, 104, 4],
  ["setTextColor", "#A0A0A0"],
  ["drawString", "{feels}", 300, 134, 2],
  // Cards: low, high, rain, wind
  ["fillRoundRect", 8, 166, 70, 66, 6, CARD],
  ["fillRoundRect", 86, 166, 70, 66, 6, CARD],
  ["fillRoundRect", 164, 166, 70, 66, 6, CARD],
  ["fillRoundRect", 242, 166, 70, 66, 6, CARD],
  ["setTextDatum", "TC"],
  ["setTextColor", "#A0B0C0"],
  ["drawString", "LOW", 43, 174, 1],
  ["drawString", "HIGH", 121, 174, 1],
  ["drawString", "RAIN", 199, 174, 1],
  ["drawString", "WIND", 277, 174, 1],
  ["setTextColor", "#80B4FF"],
  ["drawString", "{low}", 43, 186, 4],
  ["setTextColor", "#FFC040"],
  ["drawString", "{high}", 121, 186, 4],
  ["setTextColor", "#00C8FF"],
  ["drawString", "{rain}", 199, 186, 4],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "{wind}", 277, 186, 4],
  ["setTextColor", "#A0B0C0"],
  ["drawString", "C", 43, 216, 1],
  ["drawString", "C", 121, 216, 1],
  ["drawString", "chance", 199, 216, 1],
  ["drawString", "{wind_unit}", 277, 216, 1],
];

export const weather: Template = {
  id: "weather",
  name: "Weather",
  description: "Big current temperature with an icon, today's low and high, rain chance and wind.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: weatherCode,
  rows: rows("weather", weatherWire),
  sampleVars: {"clock": "Fri 22:50", "cond": "Partly cloudy", "feels": "Feels like 21", "high": "27", "ic_cloud": "#FFFFFF", "ic_cloud_y": 100, "ic_drop": "#00C8FF", "ic_drop_y": -200, "ic_psun_y": 78, "ic_sun_y": -200, "low": "20", "place": "MELBOURNE", "rain": "20%", "temp": "20", "temp_col": "#FFC040", "wind": "14", "wind_unit": "km/h N"},
};
