import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Earthquake world map (USGS)

// Map box on screen (2:1, equirectangular). Data and Draw both use these numbers.
const MAP_X = 4;
const MAP_Y = 28;
const MAP_W = 312;
const MAP_H = 156;
// Number of quake dots Draw has rows for (the biggest quakes are kept).
const SLOTS = 40;

const slotExports = Array.from({ length: SLOTS }, (_, i) => {
  const n = i + 1;
  return `export const q${n}x = dots[${i}].x, q${n}y = dots[${i}].y, q${n}r = dots[${i}].r, q${n}c = dots[${i}].c;`;
}).join("\n");

const code = String.raw`// Every M2.5+ earthquake of the past day from the USGS feed (free, no key), as dots on a
// world map: size by magnitude, colour by depth. The biggest quake gets a white ring.
// Swap FEED for "4.5_day" (bigger quakes only) or "4.5_week".
const FEED = "2.5_day";
const MAP_X = ${MAP_X}, MAP_Y = ${MAP_Y}, MAP_W = ${MAP_W}, MAP_H = ${MAP_H}; // keep in step with Draw
const SLOTS = ${SLOTS}; // dots Draw can show
const OFF = -200; // off-screen y for unused dots

let feed = null;
try {
  feed = await get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/" + FEED + ".geojson", { cache: 600 });
} catch (e) {
  console.log("USGS failed:", e.message);
}
if (!feed || typeof feed !== "object" || !Array.isArray(feed.features)) feed = null;

function mapX(lon) {
  const l = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Math.round(MAP_X + 1 + ((l + 180) / 360) * (MAP_W - 3));
}
function mapY(lat) {
  const l = Math.max(-90, Math.min(90, lat));
  return Math.round(MAP_Y + 1 + ((90 - l) / 180) * (MAP_H - 3));
}
function depthCol(d) {
  return d < 70 ? "#FF5A3C" : d < 300 ? "#FFD23F" : "#5AC8FA";
}

const quakes = (feed ? feed.features : [])
  .map((f) => {
    const p = f && f.properties;
    const c = f && f.geometry && f.geometry.coordinates;
    if (!p || typeof p.mag !== "number" || !Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
    return { mag: p.mag, lon: c[0], lat: c[1], depth: typeof c[2] === "number" ? c[2] : 0, place: String(p.place || "Unknown location"), time: p.time };
  })
  .filter((q) => q);

// Keep the biggest SLOTS quakes, drawn smallest first so big dots sit on top.
const shown = quakes.slice().sort((a, b) => b.mag - a.mag).slice(0, SLOTS).reverse();
const dots = [];
for (let i = 0; i < SLOTS; i++) {
  const q = shown[i];
  dots.push(q
    ? { x: mapX(q.lon), y: mapY(q.lat), r: Math.max(2, Math.round((q.mag - 2) * 2)), c: depthCol(q.depth) }
    : { x: 0, y: OFF, r: 0, c: "#000000" });
}
${slotExports}

// Font 2 glyph widths (chars 32-126), to cut the place name to the space it has.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const w2 = (s) => [...s].reduce((n, ch) => n + (W2[ch.charCodeAt(0) - 32] || 8), 0);
function fit(s, px) {
  s = s.replace(/[^\x20-\x7E]/g, "");
  if (w2(s) <= px) return s;
  while (s.length && w2(s + "..") > px) s = s.slice(0, -1);
  return s.trimEnd() + "..";
}
function ago(ms) {
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 60) return min + " min ago";
  const h = Math.floor(min / 60);
  return h < 24 ? h + " h ago" : Math.floor(h / 24) + " d ago";
}

const big = shown.length ? shown[shown.length - 1] : null;
const bigR = big ? Math.max(2, Math.round((big.mag - 2) * 2)) : 0;
export const ring_x = big ? mapX(big.lon) : 0;
export const ring_y = big ? mapY(big.lat) : OFF;
export const ring_r = bigR + 4;

export const count = feed ? String(feed.metadata && typeof feed.metadata.count === "number" ? feed.metadata.count : quakes.length) : "--";
export const big_mag = big ? "M" + big.mag.toFixed(1) : "";
export const big_col = big ? depthCol(big.depth) : "#FFFFFF";
export const big_place = big ? fit(big.place, 160) : !feed ? "USGS feed unavailable" : "No quakes today";
export const place_x = big ? 146 : 82;
export const big_info = big ? (typeof big.time === "number" ? ago(big.time) + ", " : "") + Math.round(big.depth) + " km deep" : "";
export const clock = now("HH:mm");
`;

const BG = "#000000";
const HEAD = "#2A1A0E";
const SEA = "#081830";
const LAND_COL = "#1E3C2C";
const GRID = "#1A3050";
const AXIS = "#4A78A8";
const CARD = "#1C1C24";
const LABEL = "#9A9AA8";
const ACCENT = "#FFA040";

// Same map construction as iss-tracker.
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
];

const dotWire: RawWireOp[] = Array.from({ length: SLOTS }, (_, i): RawWireOp => {
  const n = i + 1;
  return ["fillCircle", `{q${n}x}`, `{q${n}y}`, `{q${n}r}`, `{q${n}c}`];
});

// Depth legend in the header: [dot x, label].
const legend: [number, string][] = [
  [128, "<70KM"],
  [170, "<300"],
  [206, "300+"],
];
const legendCols = ["#FF5A3C", "#FFD23F", "#5AC8FA"];

const FOOT_Y = 188;
const FOOT_H = 48;

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: title, depth legend, time
  ["fillRect", 0, 0, 320, 24, HEAD],
  ["text", "QUAKES 24H", 8, 12, 2, 1, "ML", ACCENT],
  ...legend.flatMap(([x, label], i): RawWireOp[] => [
    ["fillCircle", x, 12, 3, legendCols[i]],
    ["text", label, x + 6, 12, 1, 1, "ML", "#D0D0D8"],
  ]),
  ["text", "{clock}", 312, 12, 2, 1, "MR", "#E0E0E0"],
  // Map
  ["fillRect", MAP_X, MAP_Y, MAP_W, MAP_H, SEA],
  ...landWire,
  ...gridWire,
  ["drawRect", MAP_X, MAP_Y, MAP_W, MAP_H, AXIS],
  // Quakes, then a ring on the biggest
  ...dotWire,
  ["drawCircle", "{ring_x}", "{ring_y}", "{ring_r}", "#FFFFFF"],
  // Footer: count and the largest event
  ["fillRoundRect", 4, FOOT_Y, 312, FOOT_H, 6, CARD],
  ["text", "M2.5+", 12, FOOT_Y + 6, 1, 1, "TL", LABEL],
  ["text", "{count}", 12, FOOT_Y + 17, 4, 1, "TL", "#FFFFFF"],
  ["drawFastVLine", 72, FOOT_Y + 6, FOOT_H - 12, "#3A3A48"],
  ["text", "LARGEST", 82, FOOT_Y + 6, 1, 1, "TL", LABEL],
  ["text", "{big_info}", 308, FOOT_Y + 6, 1, 1, "TR", LABEL],
  ["text", "{big_mag}", 82, FOOT_Y + 19, 4, 1, "TL", "{big_col}"],
  ["text", "{big_place}", "{place_x}", FOOT_Y + 25, 2, 1, "TL", "#FFFFFF"],
];

const template: Template = {
  id: "quake-world-map",
  name: "Earthquake map",
  description: "The past day's M2.5+ earthquakes as dots on a world map, sized by magnitude and coloured by depth, with the count and largest event.",
  apis: ["USGS Earthquakes"],
  category: "science",
  dataCode: code,
  rows: rows("quake-world-map", wire),
  sampleVars: {"big_col":"#FF5A3C","big_info":"13 h ago, 10 km deep","big_mag":"M5.6","place_x":146,"big_place":"southeast of the Loyalt..","clock":"01:21","count":"49","q10c":"#FF5A3C","q10r":2,"q10x":35,"q10y":47,"q11c":"#FFD23F","q11r":2,"q11x":27,"q11y":55,"q12c":"#FF5A3C","q12r":2,"q12x":55,"q12y":74,"q13c":"#FFD23F","q13r":2,"q13x":28,"q13y":55,"q14c":"#FF5A3C","q14r":2,"q14x":75,"q14y":81,"q15c":"#FF5A3C","q15r":2,"q15x":55,"q15y":74,"q16c":"#FF5A3C","q16r":2,"q16x":55,"q16y":74,"q17c":"#FFD23F","q17r":3,"q17x":101,"q17y":89,"q18c":"#FF5A3C","q18r":3,"q18x":55,"q18y":74,"q19c":"#FF5A3C","q19r":3,"q19x":55,"q19y":74,"q1c":"#FFD23F","q1r":2,"q1x":29,"q1y":55,"q20c":"#FFD23F","q20r":3,"q20x":30,"q20y":54,"q21c":"#FF5A3C","q21r":3,"q21x":101,"q21y":89,"q22c":"#5AC8FA","q22r":4,"q22x":278,"q22y":78,"q23c":"#FF5A3C","q23r":4,"q23x":58,"q23y":77,"q24c":"#FFD23F","q24r":5,"q24x":292,"q24y":110,"q25c":"#5AC8FA","q25r":5,"q25x":7,"q25y":122,"q26c":"#FFD23F","q26r":5,"q26x":272,"q26y":111,"q27c":"#FF5A3C","q27r":5,"q27x":178,"q27y":75,"q28c":"#FF5A3C","q28r":5,"q28x":209,"q28y":97,"q29c":"#FF5A3C","q29r":5,"q29x":306,"q29y":126,"q2c":"#FF5A3C","q2r":2,"q2x":55,"q2y":74,"q30c":"#FFD23F","q30r":6,"q30x":100,"q30y":132,"q31c":"#FF5A3C","q31r":6,"q31x":247,"q31y":82,"q32c":"#FFD23F","q32r":6,"q32x":284,"q32y":110,"q33c":"#FF5A3C","q33r":6,"q33x":55,"q33y":74,"q34c":"#FF5A3C","q34r":6,"q34x":65,"q34y":113,"q35c":"#FF5A3C","q35r":6,"q35x":307,"q35y":127,"q36c":"#FF5A3C","q36r":6,"q36x":98,"q36y":133,"q37c":"#FFD23F","q37r":6,"q37x":267,"q37y":101,"q38c":"#FF5A3C","q38r":7,"q38x":131,"q38y":152,"q39c":"#FF5A3C","q39r":7,"q39x":209,"q39y":97,"q3c":"#FF5A3C","q3r":2,"q3x":55,"q3y":74,"q40c":"#FF5A3C","q40r":7,"q40x":306,"q40y":126,"q4c":"#FF5A3C","q4r":2,"q4x":55,"q4y":74,"q5c":"#FF5A3C","q5r":2,"q5x":55,"q5y":74,"q6c":"#FF5A3C","q6r":2,"q6x":30,"q6y":53,"q7c":"#FF5A3C","q7r":2,"q7x":102,"q7y":90,"q8c":"#FF5A3C","q8r":2,"q8x":26,"q8y":89,"q9c":"#FFD23F","q9r":2,"q9x":28,"q9y":54,"ring_r":11,"ring_x":306,"ring_y":126},
};

export default template;
