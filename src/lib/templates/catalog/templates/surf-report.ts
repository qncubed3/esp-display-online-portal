import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Surf report

const surfCode = String.raw`// Surf at Bells Beach / Torquay from Open-Meteo marine + forecast (free, no key).
// Set PLACE, LAT and LON to your break.
const PLACE = "BELLS BEACH";
const LAT = -38.37;
const LON = 144.28;
const TZ = "Australia%2FMelbourne";
const HIDE = -200; // y for bars that should not show

// Bar chart geometry, matching Draw: 12 bars standing on BASE, at most MAX_H tall.
const BARS = 12;
const BASE = 216;
const MAX_H = 42;

const DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) => (typeof deg === "number" ? DIRS[Math.round(deg / 22.5) % 16] : "--");
const num = (v, dp) => (typeof v === "number" ? v.toFixed(dp) : "--");

let sea = null;
try {
  // Two days so the next 12 hours are there late in the evening too.
  sea = await get(
    "https://marine-api.open-meteo.com/v1/marine?latitude=" + LAT + "&longitude=" + LON +
      "&current=wave_height,wave_period,wave_direction,swell_wave_height,sea_surface_temperature" +
      "&hourly=wave_height&timezone=" + TZ + "&forecast_days=2",
    { cache: 1800 },
  );
} catch (e) {
  sea = null;
}

let air = null;
try {
  air = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=" + TZ,
    { cache: 1800 },
  );
} catch (e) {
  air = null;
}

const c = (sea && sea.current) || {};
const w = (air && air.current) || {};

export const place = PLACE;
export const clock = now("ddd HH:mm");

const hs = c.wave_height;
export const wave = num(hs, 1);
export const wave_col = typeof hs !== "number" ? "#A0A0A0" : hs < 0.5 ? "#A8C4DC" : hs < 1.5 ? "#4FD2FF" : hs < 2.5 ? "#4CE08A" : "#FFB040";
export const period = typeof c.wave_period === "number" ? Math.round(c.wave_period) + "s" : "--";
export const dir = compass(c.wave_direction);
export const swell = num(c.swell_wave_height, 1);
export const sst = num(c.sea_surface_temperature, 1);
export const wind = typeof w.wind_speed_10m === "number" ? String(Math.round(w.wind_speed_10m)) : "--";
export const wind_unit = "km/h " + compass(w.wind_direction_10m);
export const status = sea ? "" : "Marine data unavailable";

// Next 12 hours of wave height, starting at the current hour.
const times = (sea && sea.hourly && sea.hourly.time) || [];
const heights = (sea && sea.hourly && sea.hourly.wave_height) || [];
const hourKey = typeof c.time === "string" ? c.time.slice(0, 13) : now("YYYY-MM-DD") + "T" + now("HH");
let start = times.findIndex((t) => t.slice(0, 13) === hourKey);
if (start < 0) start = 0;
const next = heights.slice(start, start + BARS);
const vals = next.filter((v) => typeof v === "number");
const peak = vals.length ? Math.max(...vals) : 0;
const top = Math.max(1, Math.ceil(peak * 2) / 2); // scale: at least 1 m, rounded up to 0.5 m

function hourLabel(i) {
  const t = times[start + i];
  if (typeof t !== "string") return "";
  const h = Number(t.slice(11, 13));
  return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "am" : "pm");
}
const peakAt = next.indexOf(peak);
export const peak_text = vals.length ? "PEAK " + peak.toFixed(1) + "m " + (peakAt === 0 ? "now" : hourLabel(peakAt)) : "";

const bar = (i) => {
  const v = next[i];
  if (typeof v !== "number") return { h: 0, y: HIDE };
  const h = Math.max(2, Math.round((v / top) * MAX_H));
  return { h, y: BASE - h };
};
export const b0_h = bar(0).h, b0_y = bar(0).y;
export const b1_h = bar(1).h, b1_y = bar(1).y;
export const b2_h = bar(2).h, b2_y = bar(2).y;
export const b3_h = bar(3).h, b3_y = bar(3).y;
export const b4_h = bar(4).h, b4_y = bar(4).y;
export const b5_h = bar(5).h, b5_y = bar(5).y;
export const b6_h = bar(6).h, b6_y = bar(6).y;
export const b7_h = bar(7).h, b7_y = bar(7).y;
export const b8_h = bar(8).h, b8_y = bar(8).y;
export const b9_h = bar(9).h, b9_y = bar(9).y;
export const b10_h = bar(10).h, b10_y = bar(10).y;
export const b11_h = bar(11).h, b11_y = bar(11).y;
export const t0 = vals.length ? "now" : "";
export const t3 = hourLabel(3);
export const t6 = hourLabel(6);
export const t9 = hourLabel(9);
`;

const BG = "#000000";
const CARD = "#10243A";
const MUTED = "#8FB0CC";
const BAR = "#2E86C1";
const BAR_NOW = "#7FD8FF";

// Bar i: x of its left edge (12 slots of 24 px from x=16, bars 18 wide).
const barX = (i: number) => 16 + i * 24 + 3;
const slotCx = (i: number) => 16 + i * 24 + 12;

const surfWire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, "#003A5C"],
  ["text", "{place}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C0D8EC"],

  // Wave height, big
  ["text", "WAVE HEIGHT", 12, 34, 1, 1, "TL", MUTED],
  ["text", "{wave}", 112, 46, 4, 2, "TR", "{wave_col}"],
  ["text", "m", 116, 72, 4, 1, "TL", "{wave_col}"],
  // Period and direction
  ["text", "PERIOD", 12, 106, 1, 1, "TL", MUTED],
  ["text", "{period}", 12, 116, 4, 1, "TL", "#FFFFFF"],
  ["text", "FROM", 88, 106, 1, 1, "TL", MUTED],
  ["text", "{dir}", 88, 116, 4, 1, "TL", "#FFFFFF"],

  // Right column cards: swell, water, wind
  ["fillRoundRect", 170, 32, 142, 34, 6, CARD],
  ["fillRoundRect", 170, 70, 142, 34, 6, CARD],
  ["fillRoundRect", 170, 108, 142, 34, 6, CARD],
  ["text", "SWELL", 178, 39, 1, 1, "TL", MUTED],
  ["text", "m", 178, 51, 1, 1, "TL", "#FFFFFF"],
  ["text", "{swell}", 304, 50, 4, 1, "MR", "#FFFFFF"],
  ["text", "WATER", 178, 77, 1, 1, "TL", MUTED],
  ["drawCircle", 180, 91, 2, "#FFFFFF"],
  ["text", "C", 184, 89, 1, 1, "TL", "#FFFFFF"],
  ["text", "{sst}", 304, 88, 4, 1, "MR", "#7FD8FF"],
  ["text", "WIND", 178, 115, 1, 1, "TL", MUTED],
  ["text", "{wind_unit}", 178, 127, 1, 1, "TL", "#FFFFFF"],
  ["text", "{wind}", 304, 126, 4, 1, "MR", "#FFFFFF"],

  // Next 12 hours bar chart
  ["fillRoundRect", 8, 148, 304, 88, 6, CARD],
  ["text", "NEXT 12 HOURS", 16, 153, 2, 1, "TL", MUTED],
  ["text", "{peak_text}", 304, 153, 2, 1, "TR", "#FFFFFF"],
  ["text", "{status}", 160, 192, 2, 1, "MC", "#FF8060"],
  ["drawFastHLine", 16, 216, 288, "#3A5670"],
  ...Array.from({ length: 12 }, (_, i): RawWireOp => ["fillRect", barX(i), `{b${i}_y}`, 18, `{b${i}_h}`, i === 0 ? BAR_NOW : BAR]),
  ["text", "{t0}", slotCx(0), 220, 1, 1, "TC", MUTED],
  ["text", "{t3}", slotCx(3), 220, 1, 1, "TC", MUTED],
  ["text", "{t6}", slotCx(6), 220, 1, 1, "TC", MUTED],
  ["text", "{t9}", slotCx(9), 220, 1, 1, "TC", MUTED],
];

const template: Template = {
  id: "surf-report",
  name: "Surf report",
  description: "Bells Beach waves: height, period and direction, swell, water temperature, wind, and a 12-hour wave chart.",
  apis: ["Open-Meteo Marine", "Open-Meteo"],
  category: "weather",
  dataCode: surfCode,
  rows: rows("surf-report", surfWire),
  sampleVars: {"b0_h": 25, "b0_y": 191, "b10_h": 24, "b10_y": 192, "b11_h": 24, "b11_y": 192, "b1_h": 25, "b1_y": 191, "b2_h": 25, "b2_y": 191, "b3_h": 24, "b3_y": 192, "b4_h": 24, "b4_y": 192, "b5_h": 24, "b5_y": 192, "b6_h": 24, "b6_y": 192, "b7_h": 24, "b7_y": 192, "b8_h": 24, "b8_y": 192, "b9_h": 24, "b9_y": 192, "clock": "Sat 01:01", "dir": "S", "peak_text": "PEAK 0.6m now", "period": "10s", "place": "BELLS BEACH", "sst": "16.8", "status": "", "swell": "0.5", "t0": "now", "t3": "4am", "t6": "7am", "t9": "10am", "wave": "0.6", "wave_col": "#4FD2FF", "wind": "16", "wind_unit": "km/h W"},
};

export default template;
