import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// ISS tracker

// Map box on screen (2:1, equirectangular). Data and Draw both use these numbers.
const MAP_X = 24;
const MAP_Y = 28;
const MAP_W = 272;
const MAP_H = 136;

const issCode = String.raw`// Where the International Space Station is right now, from wheretheiss.at (free, no key).
// The map is an equirectangular box; the ISS dot and the sun (the point where the sun is
// overhead) are placed on it here as screen x/y.
const MAP_X = ${MAP_X}, MAP_Y = ${MAP_Y}, MAP_W = ${MAP_W}, MAP_H = ${MAP_H}; // keep in step with Draw
const OFF = -100; // off-screen y for markers with no data

let iss = null;
try {
  iss = await get("https://api.wheretheiss.at/v1/satellites/25544", { cache: 15 });
} catch (e) {
  iss = null;
}
const ok = iss && typeof iss.latitude === "number" && typeof iss.longitude === "number";

function mapX(lon) {
  return Math.round(MAP_X + 1 + ((lon + 180) / 360) * (MAP_W - 3));
}
function mapY(lat) {
  return Math.round(MAP_Y + 1 + ((90 - lat) / 180) * (MAP_H - 3));
}
function lonDeg(lon) {
  // Some feeds give longitude as 0..360; bring it into -180..180.
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

const lat = ok ? iss.latitude : 0;
const lon = ok ? lonDeg(iss.longitude) : 0;
const day = ok && iss.visibility === "daylight";

export const lat_val = ok ? Math.abs(lat).toFixed(1) : "--";
export const lat_dir = ok ? (lat >= 0 ? "NORTH" : "SOUTH") : "";
export const lon_val = ok ? Math.abs(lon).toFixed(1) : "--";
export const lon_dir = ok ? (lon >= 0 ? "EAST" : "WEST") : "";
export const alt = ok ? String(Math.round(iss.altitude)) : "--";
export const speed = ok ? Math.round(iss.velocity).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "--";

export const vis = !ok ? "NO DATA" : day ? "DAYLIGHT" : "ECLIPSE";
export const vis_bg = !ok ? "#404040" : day ? "#FFC800" : "#2C3E66";
export const vis_fg = !ok ? "#FFFFFF" : day ? "#000000" : "#C8D8FF";

export const dot_x = ok ? mapX(lon) : 0;
export const dot_y = ok ? mapY(lat) : OFF;

const sunOk = ok && typeof iss.solar_lat === "number" && typeof iss.solar_lon === "number";
export const sun_x = sunOk ? mapX(lonDeg(iss.solar_lon)) : 0;
export const sun_y = sunOk ? mapY(iss.solar_lat) : OFF;

export const clock = now("HH:mm:ss");
`;

const BG = "#000000";
const HEAD = "#0B1A33";
const SEA = "#081830";
const LAND_COL = "#1E3C2C";
const GRID = "#1A3050";
const AXIS = "#4A78A8";
const CARD = "#14243A";
const LABEL = "#8FA8C8";

// Map grid: every 30 degrees dim, equator and prime meridian bright.
const gx = (lon: number) => Math.round(MAP_X + 1 + ((lon + 180) / 360) * (MAP_W - 3));
const gy = (lat: number) => Math.round(MAP_Y + 1 + ((90 - lat) / 180) * (MAP_H - 3));

// Very rough land, in 10-degree cells: one row per band from 90N down to 90S,
// each as [first, last] column pairs where column c covers longitude -180 + 10c.
const LAND: [number, number][][] = [
  [[12, 15]],
  [[6, 10], [11, 15], [19, 20], [24, 31]],
  [[1, 11], [13, 14], [16, 16], [19, 35]],
  [[5, 11], [17, 31], [34, 34]],
  [[6, 11], [17, 30], [32, 32]],
  [[6, 10], [17, 29], [31, 31]],
  [[7, 9], [16, 23], [25, 29]],
  [[8, 9], [16, 22], [25, 25], [28, 28]],
  [[10, 12], [17, 21], [28, 29]],
  [[10, 13], [19, 21], [28, 31]],
  [[10, 13], [19, 22], [30, 32]],
  [[11, 13], [19, 20], [29, 32]],
  [[11, 12], [19, 19], [30, 32]],
  [[10, 11], [35, 35]],
  [[11, 11]],
  [],
  [[0, 35]],
  [[0, 35]],
];
const landWire: RawWireOp[] = LAND.flatMap((runs, row) =>
  runs.map(([a, b]): RawWireOp => {
    const x0 = gx(-180 + 10 * a);
    const y0 = gy(90 - 10 * row);
    return ["fillRect", x0, y0, gx(-170 + 10 * b) - x0, gy(80 - 10 * row) - y0, LAND_COL];
  }),
);

const gridWire: RawWireOp[] = [
  ...[-150, -120, -90, -60, -30, 30, 60, 90, 120, 150].map((l): RawWireOp => ["drawFastVLine", gx(l), MAP_Y + 1, MAP_H - 2, GRID]),
  ...[-60, -30, 30, 60].map((l): RawWireOp => ["drawFastHLine", MAP_X + 1, gy(l), MAP_W - 2, GRID]),
  ["drawFastHLine", MAP_X + 1, gy(0), MAP_W - 2, AXIS],
  ["drawFastVLine", gx(0), MAP_Y + 1, MAP_H - 2, AXIS],
];

// Stat cards along the bottom: [x, width, label, value var, unit].
const CARD_Y = 170;
const CARD_H = 66;
const cards: [number, number, string, string, string][] = [
  [4, 72, "LATITUDE", "{lat_val}", "{lat_dir}"],
  [80, 72, "LONGITUDE", "{lon_val}", "{lon_dir}"],
  [156, 68, "ALTITUDE", "{alt}", "KM"],
  [228, 88, "SPEED", "{speed}", "KM/H"],
];

const issWire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: title, visibility pill, update time
  ["fillRect", 0, 0, 320, 24, HEAD],
  ["text", "ISS", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "NOW", 34, 12, 2, 1, "ML", LABEL],
  ["fillRoundRect", 112, 3, 96, 18, 9, "{vis_bg}"],
  ["text", "{vis}", 160, 12, 2, 1, "MC", "{vis_fg}"],
  ["text", "{clock}", 312, 12, 2, 1, "MR", "#C0D0E0"],
  // Map
  ["fillRect", MAP_X, MAP_Y, MAP_W, MAP_H, SEA],
  ...landWire,
  ...gridWire,
  ["drawRect", MAP_X, MAP_Y, MAP_W, MAP_H, AXIS],
  ["text", "0", gx(0) + 3, MAP_Y + 3, 1, 1, "TL", AXIS],
  ["text", "EQ", MAP_X + 3, gy(0) - 2, 1, 1, "BL", AXIS],
  // Sun (point where the sun is overhead), then the ISS with a ring
  ["fillCircle", "{sun_x}", "{sun_y}", 4, "#FFC800"],
  ["drawCircle", "{dot_x}", "{dot_y}", 9, "#FFFFFF"],
  ["fillCircle", "{dot_x}", "{dot_y}", 5, "#FF3B30"],
  // Cards
  ...cards.flatMap(([x, w, label, value, unit]): RawWireOp[] => {
    const cx = x + Math.floor(w / 2);
    return [
      ["fillRoundRect", x, CARD_Y, w, CARD_H, 6, CARD],
      ["text", label, cx, CARD_Y + 7, 1, 1, "TC", LABEL],
      ["text", value, cx, CARD_Y + 20, 4, 1, "TC", "#FFFFFF"],
      ["text", unit, cx, CARD_Y + 51, 1, 1, "TC", LABEL],
    ];
  }),
];

const template: Template = {
  id: "iss-tracker",
  name: "ISS tracker",
  description: "Where the International Space Station is now: a world map with its position, altitude, speed and daylight or eclipse.",
  apis: ["Where the ISS at"],
  category: "space",
  dataCode: issCode,
  rows: rows("iss-tracker", issWire),
  sampleVars: {"alt": "420", "clock": "01:00:55", "dot_x": 254, "dot_y": 72, "lat_dir": "NORTH", "lat_val": "32.0", "lon_dir": "EAST", "lon_val": "126.9", "speed": "27,589", "sun_x": 134, "sun_y": 110, "vis": "ECLIPSE", "vis_bg": "#2C3E66", "vis_fg": "#C8D8FF"},
};

export default template;
