import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Quakes near me: the latest earthquake within a radius of home, with how far away
// and in which direction it was, plus the three before it (USGS FDSN query).

const ROW_Y = [146, 174, 202]; // top of each "earlier" row in Draw

const code = String.raw`// Recent earthquakes near home from the USGS FDSN event query (free, no key).
// Change PLACE, LAT and LON to your location; RADIUS_KM and MIN_MAG set what counts.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const RADIUS_KM = 3000;
const MIN_MAG = 3;

const ROW_Y = [${ROW_Y.join(", ")}]; // keep in step with Draw
const HIDE = -200; // off-screen y hides a badge
const D = Math.PI / 180;

export const title = "QUAKES NEAR " + PLACE;
export const clock = now("HH:mm");
export const footer = "USGS - M" + MIN_MAG + "+ within " + RADIUS_KM + " km";

let data = null;
try {
  data = await get("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=" + LAT +
    "&longitude=" + LON + "&maxradiuskm=" + RADIUS_KM + "&minmagnitude=" + MIN_MAG + "&orderby=time&limit=4", { cache: 1800 });
} catch (e) {
  console.log("USGS failed:", e.message);
}
if (!data || typeof data !== "object" || !Array.isArray(data.features)) data = null;
const quakes = data ? data.features.filter((q) => q && q.properties && typeof q.properties.mag === "number") : [];

// Font 2 glyph widths (chars 32-126), to cut place names to the space they have.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const w2 = (s) => [...s].reduce((n, ch) => n + (W2[ch.charCodeAt(0) - 32] || 8), 0);
const ascii = (s) => String(s).normalize("NFD").replace(/[^\x20-\x7E]/g, "");
function fit(s, px) {
  if (w2(s) <= px) return s;
  while (s.length && w2(s + "..") > px) s = s.slice(0, -1);
  return s.replace(/[\s,;:-]+$/, "") + "..";
}
// Split into two lines that each fit px; the second is cut with ".." if needed.
function wrap2(s, px) {
  if (w2(s) <= px) return [s, ""];
  const words = s.split(" ");
  let a = "";
  while (words.length && w2((a ? a + " " : "") + words[0]) <= px) a = (a ? a + " " : "") + words.shift();
  if (!a) return [fit(s, px), ""];
  return [a, fit(words.join(" "), px)];
}

const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
// Ground distance (km) and compass point from home to a quake.
function where(q) {
  const c = q.geometry && q.geometry.coordinates;
  if (!c || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
  const lo2 = c[0], la2 = c[1];
  const a = Math.sin(((la2 - LAT) * D) / 2) ** 2 +
    Math.cos(LAT * D) * Math.cos(la2 * D) * Math.sin(((lo2 - LON) * D) / 2) ** 2;
  const km = 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin((lo2 - LON) * D) * Math.cos(la2 * D);
  const x = Math.cos(LAT * D) * Math.sin(la2 * D) - Math.sin(LAT * D) * Math.cos(la2 * D) * Math.cos((lo2 - LON) * D);
  const brg = ((Math.atan2(y, x) / D) + 360) % 360;
  return { km: Math.round(km), dir: POINTS[Math.round(brg / 45) % 8], depth: typeof c[2] === "number" ? Math.round(c[2]) : null };
}
function ago(ms, long) {
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return min + " min" + (long ? " ago" : "");
  const h = Math.floor(min / 60);
  if (h < 24) return long ? h + " h " + (min % 60) + " min ago" : h + " h";
  return Math.floor(h / 24) + " d" + (long ? " ago" : "");
}
const colour = (m) => (m >= 6 ? "#FF4D4D" : m >= 5 ? "#FF9F1C" : m >= 4 ? "#FFD23F" : "#3DDC84");

// Latest quake: the big panel.
const top = quakes[0];
const tw = top ? where(top) : null;
const tp = top ? top.properties : null;
const lines = tp ? wrap2(ascii(tp.place || "Unknown location"), 210) : ["", ""];
export const mag = tp ? tp.mag.toFixed(1) : "--";
export const mag_col = tp ? colour(tp.mag) : "#404040";
export const place_a = lines[0];
export const place_b = lines[1];
export const dist = tw ? commas(tw.km) + " km " + tw.dir : "";
export const when = tp && typeof tp.time === "number" ? ago(tp.time, true) : "";
export const depth = tw && tw.depth !== null ? tw.depth + " km deep" : "";
export const message = !data ? "USGS unavailable" : quakes.length ? "" : "No recent quakes nearby";
export const earlier = quakes.length > 1 ? "EARLIER" : "";

// Three earlier quakes: small rows.
function row(i) {
  const q = quakes[i + 1];
  if (!q) return { mag: "", col: "#000000", y: HIDE, place: "", info: "" };
  const p = q.properties, w = where(q);
  return {
    mag: p.mag.toFixed(1),
    col: colour(p.mag),
    y: ROW_Y[i],
    place: fit(ascii(p.place || "Unknown location"), 150),
    info: (w ? commas(w.km) + " km  " : "") + (typeof p.time === "number" ? ago(p.time, false) : ""),
  };
}
const r = [0, 1, 2].map(row);
export const m1 = r[0].mag, c1 = r[0].col, y1 = r[0].y, p1 = r[0].place, i1 = r[0].info;
export const m2 = r[1].mag, c2 = r[1].col, y2 = r[1].y, p2 = r[1].place, i2 = r[1].info;
export const m3 = r[2].mag, c3 = r[2].col, y3 = r[2].y, p3 = r[2].place, i3 = r[2].info;
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#202020"],
  ["text", "{title}", 8, 13, 2, 1, "ML", "#FFA500"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Latest quake: magnitude badge, place, distance and direction, time and depth
  ["fillRoundRect", 8, 34, 84, 66, 8, "{mag_col}"],
  ["text", "{mag}", 50, 68, 4, 2, "MC", "#000000"],
  ["text", "{place_a}", 102, 34, 2, 1, "TL", "#FFFFFF"],
  ["text", "{place_b}", 102, 51, 2, 1, "TL", "#FFFFFF"],
  ["text", "{dist}", 102, 74, 4, 1, "TL", "#FFA500"],
  ["text", "{when}", 8, 110, 2, 1, "TL", "#C0C0C0"],
  ["text", "{depth}", 312, 110, 2, 1, "TR", "#808080"],
  ["text", "{message}", 160, 160, 2, 1, "MC", "#FF5A5F"],
  // Earlier quakes
  ["drawFastHLine", 8, 131, 304, "#303030"],
  ["text", "{earlier}", 8, 135, 1, 1, "TL", "#808080"],
  ...[1, 2, 3].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      ["fillRoundRect", 8, `{y${n}}`, 40, 22, 4, `{c${n}}`],
      ["text", `{m${n}}`, 28, y + 11, 2, 1, "MC", "#000000"],
      ["text", `{p${n}}`, 56, y + 11, 2, 1, "ML", "#FFFFFF"],
      ["text", `{i${n}}`, 312, y + 11, 2, 1, "MR", "#C0C0C0"],
    ];
  }),
  ["text", "{footer}", 160, 230, 1, 1, "TC", "#606060"],
];

const template: Template = {
  id: "quake-near-me",
  name: "Quakes near me",
  description: "The latest earthquake within 3,000 km of home, with its distance and direction, plus the three before it.",
  apis: ["USGS Earthquakes"],
  category: "science",
  dataCode: code,
  rows: rows("quake-near-me", wire),
  sampleVars: {"c1":"#FF9F1C","c2":"#FF9F1C","c3":"#FFD23F","clock":"01:20","depth":"10 km deep","dist":"2,876 km NE","earlier":"EARLIER","footer":"USGS - M3+ within 3000 km","i1":"2,890 km  3 h","i2":"2,877 km  13 h","i3":"2,334 km  3 d","m1":"5.0","m2":"5.6","m3":"4.9","mag":"4.7","mag_col":"#FFD23F","message":"","p1":"southeast of the Loya..","p2":"southeast of the Loya..","p3":"43 km NW of Oxford..","place_a":"southeast of the Loyalty Islands","place_b":"","title":"QUAKES NEAR MELBOURNE","when":"3 h 31 min ago","y1":146,"y2":174,"y3":202},
};

export default template;
