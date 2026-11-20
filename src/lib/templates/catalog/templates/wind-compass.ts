import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Wind compass: a compass rose with an arrow showing which way the wind is blowing,
// plus speed, gusts, direction and the Beaufort description.

const code = String.raw`// Current wind for Melbourne from Open-Meteo (free, no key).
// The arrow shows the way the wind is blowing TO (downwind); the text names where it comes FROM.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";

const CX = 84; // compass centre and arrow length (must match the Draw rows)
const CY = 138;
const R_ARROW = 40;

export const place = "WIND  " + PLACE;
export const clock = now("HH:mm");

let speed = null, gust = null, dir = null;
try {
  const r = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=" + encodeURIComponent(TZ),
    { cache: 600 },
  );
  const c = r.current;
  if (typeof c.wind_speed_10m === "number") speed = c.wind_speed_10m;
  if (typeof c.wind_gusts_10m === "number") gust = c.wind_gusts_10m;
  if (typeof c.wind_direction_10m === "number") dir = c.wind_direction_10m;
} catch (e) {
  console.log("open-meteo failed:", e.message);
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
// Beaufort scale by km/h upper bound
const BEAUFORT = [
  [1, "Calm", "#A0B0C8"], [6, "Light air", "#8CE0FF"], [12, "Light breeze", "#8CE0FF"],
  [20, "Gentle breeze", "#60E0A0"], [29, "Moderate breeze", "#60E0A0"], [39, "Fresh breeze", "#C8E050"],
  [50, "Strong breeze", "#FFD040"], [62, "Near gale", "#FFA040"], [75, "Gale", "#FF7040"],
  [89, "Strong gale", "#FF5050"], [103, "Storm", "#FF4070"], [118, "Violent storm", "#FF40B0"],
  [9999, "Hurricane force", "#FF40FF"],
];

const haveSpeed = speed !== null;
let force = 0;
if (haveSpeed) while (force < 12 && speed >= BEAUFORT[force][0]) force++;

export const speed_txt = haveSpeed ? String(Math.round(speed)) : "--";
export const gust_txt = gust !== null ? String(Math.round(gust)) : "--";
export const beaufort = haveSpeed ? BEAUFORT[force][1] : "No data";
export const force_txt = haveSpeed ? "FORCE " + force : "";
export const accent = haveSpeed ? BEAUFORT[force][2] : "#A0B0C8";

const haveDir = dir !== null && haveSpeed && speed >= 1;
export const dir_name = haveDir ? POINTS[Math.round(dir / 22.5) % 16] : "--";
export const dir_deg = haveDir ? Math.round(dir) % 360 + " deg" : "";

// Arrow: tail on the upwind side, head on the downwind side (bearing + 180).
const OFF = -200;
const rad = ((haveDir ? dir : 0) * Math.PI) / 180;
const ux = Math.sin(rad), uy = -Math.cos(rad); // unit vector pointing to where the wind comes FROM
const px = -uy, py = ux; // perpendicular
const pt = (r, s) => [Math.round(CX + ux * r + px * s), Math.round(CY + uy * r + py * s)];
const tail = pt(R_ARROW, 0);
const tip = pt(-R_ARROW, 0);
const base = pt(-R_ARROW + 16, 0);
const b1 = pt(-R_ARROW + 16, 9);
const b2 = pt(-R_ARROW + 16, -9);
const show = (v) => (haveDir ? v : OFF);
export const t_x = show(tail[0]), t_y = show(tail[1]);
export const m_x = show(base[0]), m_y = show(base[1]);
export const h_x = show(tip[0]), h_y = show(tip[1]);
export const b1_x = show(b1[0]), b1_y = show(b1[1]);
export const b2_x = show(b2[0]), b2_y = show(b2[1]);
// a second line one pixel over, so the shaft reads as 2-3 px thick
const t2 = pt(R_ARROW, 1), m2 = pt(-R_ARROW + 16, 1);
const t3 = pt(R_ARROW, -1), m3 = pt(-R_ARROW + 16, -1);
export const t2_x = show(t2[0]), t2_y = show(t2[1]), m2_x = show(m2[0]), m2_y = show(m2[1]);
export const t3_x = show(t3[0]), t3_y = show(t3[1]), m3_x = show(m3[0]), m3_y = show(m3[1]);
export const calm_txt = haveSpeed && !haveDir ? "CALM" : "";
`;

const BG = "#000000";
const CARD = "#1A2436";
const LABEL = "#A0B0C8";
const RING = "#5A6C8C";
const CX = 84;
const CY = 138;
const R = 72;

// 16 tick marks around the rim: long for N/E/S/W, medium for NE etc., short for the rest.
const ticks: RawWireOp[] = [];
for (let i = 0; i < 16; i++) {
  const a = (i * 22.5 * Math.PI) / 180;
  const len = i % 4 === 0 ? 9 : i % 2 === 0 ? 7 : 4;
  const sx = Math.sin(a), sy = -Math.cos(a);
  ticks.push([
    "drawLine",
    Math.round(CX + sx * (R - len)),
    Math.round(CY + sy * (R - len)),
    Math.round(CX + sx * R),
    Math.round(CY + sy * R),
    i % 4 === 0 ? "#FFFFFF" : RING,
  ]);
}

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 28, "#0C1A33"],
  ["text", "{place}", 8, 14, 2, 1, "ML", "#C8D4E8"],
  ["text", "{clock}", 312, 15, 4, 1, "MR", "#FFFFFF"],
  // Compass rose
  ["fillCircle", CX, CY, R, "#0E1626"],
  ["drawCircle", CX, CY, R, RING],
  ["drawCircle", CX, CY, R - 1, RING],
  ...ticks,
  ["text", "N", CX, CY - 52, 2, 1, "MC", "#FF6060"],
  ["text", "E", CX + 53, CY, 2, 1, "MC", "#FFFFFF"],
  ["text", "S", CX, CY + 53, 2, 1, "MC", "#FFFFFF"],
  ["text", "W", CX - 53, CY, 2, 1, "MC", "#FFFFFF"],
  // Arrow: shaft from upwind tail to the head base, then the head pointing downwind
  ["drawLine", "{t_x}", "{t_y}", "{m_x}", "{m_y}", "{accent}"],
  ["drawLine", "{t2_x}", "{t2_y}", "{m2_x}", "{m2_y}", "{accent}"],
  ["drawLine", "{t3_x}", "{t3_y}", "{m3_x}", "{m3_y}", "{accent}"],
  ["fillTriangle", "{h_x}", "{h_y}", "{b1_x}", "{b1_y}", "{b2_x}", "{b2_y}", "{accent}"],
  ["fillCircle", "{t_x}", "{t_y}", 3, "{accent}"],
  ["fillCircle", CX, CY, 3, "#FFFFFF"],
  ["text", "{calm_txt}", CX, CY + 20, 2, 1, "MC", LABEL],
  ["text", "ARROW = BLOWING TO", CX, 226, 1, 1, "MC", LABEL],
  // Speed card
  ["fillRoundRect", 166, 34, 148, 88, 6, CARD],
  ["text", "SPEED km/h", 174, 42, 1, 1, "TL", LABEL],
  ["text", "{force_txt}", 306, 42, 1, 1, "TR", "{accent}"],
  ["text", "{speed_txt}", 240, 58, 4, 2, "TC", "#FFFFFF"],
  // Beaufort description
  ["fillRoundRect", 166, 128, 148, 36, 6, CARD],
  ["text", "{beaufort}", 240, 146, 2, 1, "MC", "{accent}"],
  // Gusts and direction
  ["fillRoundRect", 166, 170, 148, 64, 6, CARD],
  ["drawFastVLine", 240, 178, 48, "#2E3C56"],
  ["text", "GUSTS", 203, 178, 1, 1, "TC", LABEL],
  ["text", "{gust_txt}", 203, 192, 4, 1, "TC", "#FFFFFF"],
  ["text", "km/h", 203, 221, 1, 1, "TC", LABEL],
  ["text", "FROM", 277, 178, 1, 1, "TC", LABEL],
  ["text", "{dir_name}", 277, 192, 4, 1, "TC", "#FFFFFF"],
  ["text", "{dir_deg}", 277, 221, 1, 1, "TC", LABEL],
];

const template: Template = {
  id: "wind-compass",
  name: "Wind compass",
  description: "Compass rose with an arrow showing which way the wind blows in Melbourne, plus speed, gusts, direction and the Beaufort description.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("wind-compass", wire),
  sampleVars: {"accent": "#60E0A0", "b1_x": 102, "b1_y": 156, "b2_x": 86, "b2_y": 164, "beaufort": "Gentle breeze", "calm_txt": "", "clock": "14:30", "dir_deg": "335 deg", "dir_name": "NNW", "force_txt": "FORCE 3", "gust_txt": "30", "h_x": 101, "h_y": 174, "m2_x": 95, "m2_y": 159, "m3_x": 93, "m3_y": 160, "m_x": 94, "m_y": 160, "place": "WIND  MELBOURNE", "speed_txt": "14", "t2_x": 68, "t2_y": 101, "t3_x": 66, "t3_y": 102, "t_x": 67, "t_y": 102},
};

export default template;
