import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Latest earthquakes worldwide (USGS)

const dataCode = String.raw`// Latest M2.5+ earthquakes worldwide from the USGS feed (free, no key).
// Swap FEED for "4.5_day" (bigger quakes only) or "significant_week".
const FEED = "2.5_day";
const ROW_Y = [33, 74, 115, 156, 197]; // top of each row in Draw
const HIDE = -200; // y for a badge that should not show

let feed = null;
try {
  feed = await get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/" + FEED + ".geojson", { cache: 300 });
} catch (e) {
  console.log("USGS failed:", e.message);
}
if (!feed || typeof feed !== "object" || !Array.isArray(feed.features)) feed = null; // HTML error page, etc.
const quakes = feed ? feed.features : [];

// Font 2 glyph widths (chars 32-126), to cut place names to the space they have.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const w2 = (s) => [...s].reduce((n, ch) => n + (W2[ch.charCodeAt(0) - 32] || 8), 0);
function fit(s, px) {
  if (w2(s) <= px) return s;
  while (s.length && w2(s + "..") > px) s = s.slice(0, -1);
  return s.trimEnd() + "..";
}

function ago(ms) {
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  const h = Math.floor(min / 60);
  if (h < 24) return h + " h " + (min % 60) + " min ago";
  return Math.floor(h / 24) + " d ago";
}

function row(i) {
  const q = quakes[i];
  const p = q && q.properties;
  if (!p || typeof p.mag !== "number") return { mag: "", col: "#000000", y: HIDE, place: "", ago: "", depth: "" };
  const depth = q.geometry && q.geometry.coordinates ? q.geometry.coordinates[2] : null;
  return {
    mag: p.mag.toFixed(1),
    col: p.mag >= 6 ? "#FF4D4D" : p.mag >= 4 ? "#FFD23F" : "#3DDC84",
    y: ROW_Y[i],
    place: fit(String(p.place || "Unknown location"), 242),
    ago: typeof p.time === "number" ? ago(p.time) : "",
    depth: typeof depth === "number" ? Math.round(depth) + " km deep" : "",
  };
}
const r = [0, 1, 2, 3, 4].map(row);
export const mag1 = r[0].mag, col1 = r[0].col, y1 = r[0].y, place1 = r[0].place, ago1 = r[0].ago, depth1 = r[0].depth;
export const mag2 = r[1].mag, col2 = r[1].col, y2 = r[1].y, place2 = r[1].place, ago2 = r[1].ago, depth2 = r[1].depth;
export const mag3 = r[2].mag, col3 = r[2].col, y3 = r[2].y, place3 = r[2].place, ago3 = r[2].ago, depth3 = r[2].depth;
export const mag4 = r[3].mag, col4 = r[3].col, y4 = r[3].y, place4 = r[3].place, ago4 = r[3].ago, depth4 = r[3].depth;
export const mag5 = r[4].mag, col5 = r[4].col, y5 = r[4].y, place5 = r[4].place, ago5 = r[4].ago, depth5 = r[4].depth;

const count = feed && feed.metadata && typeof feed.metadata.count === "number" ? feed.metadata.count : quakes.length;
export const count_text = feed ? count + " quakes M2.5+ / 24h" : "";
export const message = !feed ? "USGS feed unavailable" : quakes.length ? "" : "No quakes in the past day";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header: title and the day's count
  ["fillRect", 0, 0, 320, 28, "#202020"],
  ["text", "EARTHQUAKES", 8, 14, 2, 1, "ML", "#FFA500"],
  ["text", "{count_text}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Row separators
  ...[2, 3, 4, 5].map((n): RawWireOp => ["drawFastHLine", 8, 33 + (n - 1) * 41 - 3, 304, "#303030"]),
  // Quakes: magnitude badge, place, time ago, depth
  ...[1, 2, 3, 4, 5].flatMap((n): RawWireOp[] => {
    const y = 33 + (n - 1) * 41;
    return [
      ["fillRoundRect", 8, `{y${n}}`, 54, 36, 6, `{col${n}}`],
      ["text", `{mag${n}}`, 35, y + 19, 4, 1, "MC", "#000000"],
      ["text", `{place${n}}`, 70, y + 2, 2, 1, "TL", "#FFFFFF"],
      ["text", `{ago${n}}`, 70, y + 20, 2, 1, "TL", "#C0C0C0"],
      ["text", `{depth${n}}`, 312, y + 20, 2, 1, "TR", "#808080"],
    ];
  }),
  ["text", "{message}", 160, 130, 2, 1, "MC", "#FF5A5F"],
];

const template: Template = {
  id: "earthquakes-latest",
  name: "Latest earthquakes",
  description: "The five most recent M2.5+ earthquakes worldwide, colour-coded by magnitude, with the day's total.",
  apis: ["USGS Earthquakes"],
  category: "science",
  dataCode,
  rows: rows("earthquakes-latest", wire),
  sampleVars: {"ago1": "48 min ago", "ago2": "2 h 31 min ago", "ago3": "2 h 44 min ago", "ago4": "2 h 59 min ago", "ago5": "3 h 4 min ago", "col1": "#FFD23F", "col2": "#FFD23F", "col3": "#3DDC84", "col4": "#3DDC84", "col5": "#FFD23F", "count_text": "49 quakes M2.5+ / 24h", "depth1": "73 km deep", "depth2": "15 km deep", "depth3": "28 km deep", "depth4": "129 km deep", "depth5": "622 km deep", "mag1": "5.1", "mag2": "4.2", "mag3": "2.9", "mag4": "2.9", "mag5": "4.4", "message": "", "place1": "15 km SSW of Balangonan, Philippines", "place2": "1 km NW of Commerce, CA", "place3": "15 km SSW of Volcano, Hawaii", "place4": "70 km SSE of Kokhanok, Alaska", "place5": "Fiji region", "y1": 33, "y2": 74, "y3": 115, "y4": 156, "y5": 197},
};

export default template;
