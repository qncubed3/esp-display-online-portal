import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Air quality & UV

const airCode = String.raw`// European AQI, PM2.5, PM10 and the UV index from Open-Meteo (free, no key).
// Set PLACE, LAT and LON to your location.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const HIDE = -50; // x for the marker when there is no data

// European AQI bands: [upper limit, name, bar colour, dimmed bar colour, text colour]
const AQI = [
  [20, "Good", "#50F0E6", "#1A4C49", "#50F0E6"],
  [40, "Fair", "#50CCAA", "#1A4136", "#50CCAA"],
  [60, "Moderate", "#F0E641", "#4C4915", "#F0E641"],
  [80, "Poor", "#FF5050", "#521A1A", "#FF5050"],
  [100, "Very poor", "#960032", "#300010", "#FF3C78"],
  [Infinity, "Extremely poor", "#7D2181", "#280A29", "#C878FF"],
];
// UV bands (rounded index): [upper limit, name, colour]
const UV = [
  [2, "Low", "#64D228"],
  [5, "Moderate", "#F7E400"],
  [7, "High", "#FF8C1E"],
  [10, "Very high", "#FF4040"],
  [Infinity, "Extreme", "#B482FF"],
];
// PM concentration bands used by the European AQI, in ug/m3 (index into AQI colours)
const PM25 = [10, 20, 25, 50, 75, Infinity];
const PM10 = [20, 40, 50, 100, 150, Infinity];

const band = (limits, v) => limits.findIndex((l) => v <= l);
const one = (v) => (Math.round(v * 10) / 10).toFixed(1);
const hourLabel = (iso) => {
  const h = Number(iso.slice(11, 13));
  return (h % 12 || 12) + (h < 12 ? "am" : "pm");
};

let aq = null;
try {
  aq = await get(
    "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + LAT + "&longitude=" + LON +
      "&current=european_aqi,pm2_5,pm10,uv_index&hourly=uv_index" +
      "&timezone=Australia%2FMelbourne&forecast_days=1",
    { cache: 900 },
  );
} catch (e) {
  aq = null;
}
const c = aq && aq.current;

export const place = PLACE;
export const clock = now("ddd HH:mm");

// Big AQI number, category and the six-segment bar
const aqi = c && c.european_aqi != null ? Math.round(c.european_aqi) : null;
const ai = aqi == null ? -1 : AQI.findIndex((b) => aqi <= b[0]);
export const aqi_val = aqi == null ? "--" : String(aqi);
export const aqi_cat = ai < 0 ? "No data" : AQI[ai][1];
export const aqi_col = ai < 0 ? "#808080" : AQI[ai][4];
export const seg0 = ai === 0 ? AQI[0][2] : AQI[0][3];
export const seg1 = ai === 1 ? AQI[1][2] : AQI[1][3];
export const seg2 = ai === 2 ? AQI[2][2] : AQI[2][3];
export const seg3 = ai === 3 ? AQI[3][2] : AQI[3][3];
export const seg4 = ai === 4 ? AQI[4][2] : AQI[4][3];
export const seg5 = ai === 5 ? AQI[5][2] : AQI[5][3];
// Marker under the active segment (segments are 48 wide, 3 apart, from x 9)
const mx = ai < 0 ? HIDE : 9 + ai * 51 + 24;
export const mark_x = mx;
export const mark_l = mx - 7;
export const mark_r = mx + 7;

// Particulates, coloured by their AQI band
const pm25 = c && c.pm2_5 != null ? c.pm2_5 : null;
const pm10 = c && c.pm10 != null ? c.pm10 : null;
export const pm25_val = pm25 == null ? "--" : one(pm25);
export const pm25_col = pm25 == null ? "#808080" : AQI[band(PM25, pm25)][4];
export const pm10_val = pm10 == null ? "--" : one(pm10);
export const pm10_col = pm10 == null ? "#808080" : AQI[band(PM10, pm10)][4];

// UV now and today's peak
const uvNow = c && c.uv_index != null ? Math.round(c.uv_index) : null;
const ui = uvNow == null ? -1 : UV.findIndex((b) => uvNow <= b[0]);
export const uv_val = uvNow == null ? "--" : String(uvNow);
export const uv_cat = ui < 0 ? "No data" : UV[ui][1];
export const uv_col = ui < 0 ? "#808080" : UV[ui][2];

const hours = aq && aq.hourly ? aq.hourly.uv_index || [] : [];
let peak = -1;
for (let i = 0; i < hours.length; i++) {
  if (hours[i] != null && (peak < 0 || hours[i] > hours[peak])) peak = i;
}
const uvMax = peak < 0 ? null : Math.round(hours[peak]);
const mi = uvMax == null ? -1 : UV.findIndex((b) => uvMax <= b[0]);
export const uvmax_val = uvMax == null ? "--" : String(uvMax);
export const uvmax_col = mi < 0 ? "#808080" : UV[mi][2];
export const uvmax_at = peak < 0 || uvMax === 0 ? "" : "at " + hourLabel(aq.hourly.time[peak]);
`;

const CARD = "#18283C";
const LABEL = "#A0B0C0";
const airWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#003366"],
  ["text", "{place}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C0D0E0"],
  // AQI: big number, category, bar with marker
  ["text", "AIR QUALITY", 10, 34, 2, 1, "TL", LABEL],
  ["text", "{aqi_val}", 10, 52, 4, 2, "TL", "{aqi_col}"],
  ["text", "{aqi_cat}", 312, 52, 4, 1, "TR", "{aqi_col}"],
  ["text", "European AQI", 312, 84, 2, 1, "TR", LABEL],
  ["fillRect", 9, 110, 48, 10, "{seg0}"],
  ["fillRect", 60, 110, 48, 10, "{seg1}"],
  ["fillRect", 111, 110, 48, 10, "{seg2}"],
  ["fillRect", 162, 110, 48, 10, "{seg3}"],
  ["fillRect", 213, 110, 48, 10, "{seg4}"],
  ["fillRect", 264, 110, 48, 10, "{seg5}"],
  ["fillTriangle", "{mark_x}", 123, "{mark_l}", 130, "{mark_r}", 130, "#FFFFFF"],
  // Cards: PM2.5, PM10, UV
  ["fillRoundRect", 8, 136, 72, 96, 6, CARD],
  ["fillRoundRect", 86, 136, 72, 96, 6, CARD],
  ["fillRoundRect", 164, 136, 148, 96, 6, CARD],
  ["text", "PM2.5", 44, 144, 2, 1, "TC", LABEL],
  ["text", "{pm25_val}", 44, 170, 4, 1, "TC", "{pm25_col}"],
  ["text", "ug/m3", 44, 208, 1, 1, "TC", LABEL],
  ["text", "PM10", 122, 144, 2, 1, "TC", LABEL],
  ["text", "{pm10_val}", 122, 170, 4, 1, "TC", "{pm10_col}"],
  ["text", "ug/m3", 122, 208, 1, 1, "TC", LABEL],
  ["text", "UV NOW", 174, 144, 2, 1, "TL", LABEL],
  ["text", "{uv_val}", 174, 166, 4, 2, "TL", "{uv_col}"],
  ["text", "{uv_cat}", 304, 144, 2, 1, "TR", "{uv_col}"],
  ["text", "MAX TODAY", 304, 172, 1, 1, "TR", LABEL],
  ["text", "{uvmax_val}", 304, 184, 4, 1, "TR", "{uvmax_col}"],
  ["text", "{uvmax_at}", 304, 214, 2, 1, "TR", LABEL],
];

const template: Template = {
  id: "air-quality-uv",
  name: "Air quality & UV",
  description: "Big European AQI with a colour-coded category bar, PM2.5 and PM10, and the UV index now and today's peak.",
  apis: ["Open-Meteo Air Quality"],
  category: "weather",
  dataCode: airCode,
  rows: rows("air-quality-uv", airWire),
  sampleVars: {"aqi_cat": "Fair", "aqi_col": "#50CCAA", "aqi_val": "30", "clock": "Sat 00:58", "mark_l": 77, "mark_r": 91, "mark_x": 84, "place": "MELBOURNE", "pm10_col": "#50F0E6", "pm10_val": "4.9", "pm25_col": "#50F0E6", "pm25_val": "4.7", "seg0": "#1A4C49", "seg1": "#50CCAA", "seg2": "#4C4915", "seg3": "#521A1A", "seg4": "#300010", "seg5": "#280A29", "uv_cat": "Low", "uv_col": "#64D228", "uv_val": "0", "uvmax_at": "at 12pm", "uvmax_col": "#FF4040", "uvmax_val": "8"},
};

export default template;
