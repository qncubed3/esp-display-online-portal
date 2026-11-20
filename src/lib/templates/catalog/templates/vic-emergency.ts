import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// VicEmergency incident counts and the latest incident (Victoria, Australia)

const dataCode = String.raw`// Live incident counts across Victoria from the public VicEmergency feed
// (the same feed emergency.vic.gov.au uses; no key). Planned burns and
// burn areas are left out of every count.
const FEED = "https://emergency.vic.gov.au/public/osom-geojson.json";

let feed = null;
try {
  feed = await get(FEED, { cache: 300 });
} catch (e) {
  console.log("VicEmergency failed:", e.message);
}
if (!feed || typeof feed !== "object" || !Array.isArray(feed.features)) feed = null;
const props = feed ? feed.features.map((f) => (f && f.properties) || {}) : [];
const incidents = props.filter((p) => p.feedType === "incident" && p.category1 !== "Planned Burn");
const warnings = props.filter((p) => p.feedType === "warning");

const count = (cat) => incidents.filter((p) => p.category1 === cat).length;
const show = (n) => (feed ? String(n) : "--");
export const n_fire = show(count("Fire"));
export const n_flood = show(count("Flooding"));
export const n_tree = show(count("Tree Down"));
export const n_damage = show(count("Building Damage"));
export const n_warn = show(warnings.length);
export const n_total = show(incidents.length);

// Font 2 and font 4 glyph widths (chars 32-126), to fit text to its space.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (W, s) => [...s].reduce((n, ch) => n + (W[ch.charCodeAt(0) - 32] || 8), 0);
function fit(W, s, px) {
  if (width(W, s) <= px) return s;
  while (s.length && width(W, s + "..") > px) s = s.slice(0, -1);
  return s.trimEnd() + "..";
}
const ascii = (s) => String(s == null ? "" : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").normalize("NFD").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
const time = (p) => {
  const t = Date.parse(p.updated || p.created || "");
  return isNaN(t) ? 0 : t;
};

function ago(ms) {
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  const h = Math.floor(min / 60);
  if (h < 24) return h + " h " + (min % 60) + " min ago";
  return Math.floor(h / 24) + " d ago";
}

// The most recently updated incident or warning.
const latest = incidents.concat(warnings).filter((p) => time(p) > 0).sort((a, b) => time(b) - time(a))[0];
const CAT_COL = { Fire: "#FF6A3D", Flooding: "#4DA6FF", "Tree Down": "#3DDC84", "Building Damage": "#FFD23F" };

let kind = "", where = "", status = "", when = "", col = "#FFA500";
if (latest) {
  const isWarn = latest.feedType === "warning";
  let k = ascii(latest.category2);
  if (!k || k === "Other" || k === "Undefined") k = ascii(latest.category1);
  if (isWarn) k = ascii(latest.name || latest.category1 || "Warning") + " warning";
  kind = fit(W4, k || "Incident", 304);
  where = fit(W2, ascii(latest.location) || "Location not given", 304);
  status = ascii(latest.status);
  when = ago(time(latest)) + (latest.sourceOrg ? "  " + ascii(latest.sourceOrg).split("/").pop() : "");
  col = isWarn ? "#FF4D4D" : CAT_COL[latest.category1] || "#FFA500";
}
export const latest_kind = kind;
export const latest_where = where;
export const latest_when = fit(W2, when, 304 - width(W2, status) - 24);
export const latest_status = fit(W2, status, 120);
export const latest_col = col;
// Status pill behind the status text; hidden when there is none.
export const pill_w = status ? width(W2, latest_status) + 12 : 0;
export const pill_x = 312 - pill_w;
export const pill_y = status ? 212 : -200;
export const message = !feed ? "VicEmergency feed unavailable" : latest ? "" : "No current incidents";
export const clock = now("HH:mm");
`;

// Tiles: 3 across, 2 down. [label, var, colour]
const TILES: [string, string, string][] = [
  ["FIRE", "n_fire", "#FF6A3D"],
  ["FLOOD", "n_flood", "#4DA6FF"],
  ["TREE DOWN", "n_tree", "#3DDC84"],
  ["BLDG DAMAGE", "n_damage", "#FFD23F"],
  ["WARNINGS", "n_warn", "#FF4D4D"],
  ["ALL INCIDENTS", "n_total", "#FFFFFF"],
];
const TILE_W = 98, TILE_H = 52, GAP = 5;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 28, "#3A1010"],
  ["text", "VIC EMERGENCY", 8, 14, 2, 1, "ML", "#FFA500"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Count tiles
  ...TILES.flatMap(([label, v, colour], i): RawWireOp[] => {
    const x = 8 + (i % 3) * (TILE_W + GAP);
    const y = 34 + Math.floor(i / 3) * (TILE_H + GAP);
    return [
      ["fillRoundRect", x, y, TILE_W, TILE_H, 5, "#1A1A1A"],
      ["fillRect", x, y + 6, 3, TILE_H - 12, colour],
      ["text", label, x + 10, y + 7, 1, 1, "TL", "#A0A0A0"],
      ["text", `{${v}}`, x + 10, y + TILE_H - 5, 4, 1, "BL", colour],
    ];
  }),
  // Latest incident
  ["drawFastHLine", 8, 152, 304, "#303030"],
  ["text", "LATEST", 8, 158, 1, 1, "TL", "#808080"],
  ["text", "{latest_kind}", 8, 168, 4, 1, "TL", "{latest_col}"],
  ["text", "{latest_where}", 8, 196, 2, 1, "TL", "#FFFFFF"],
  ["text", "{latest_when}", 8, 216, 2, 1, "TL", "#A0A0A0"],
  ["fillRoundRect", "{pill_x}", "{pill_y}", "{pill_w}", 20, 4, "{latest_col}"],
  ["text", "{latest_status}", 306, 222, 2, 1, "MR", "#000000"],
  ["text", "{message}", 160, 200, 2, 1, "MC", "#FF5A5F"],
];

const template: Template = {
  id: "vic-emergency",
  name: "VIC emergency incidents",
  description: "Live counts of fires, floods, trees down, building damage and warnings across Victoria, plus the latest incident.",
  apis: ["VicEmergency"],
  category: "world",
  dataCode,
  rows: rows("vic-emergency", wire),
  sampleVars: {"clock":"01:20","latest_col":"#FF6A3D","latest_kind":"Structure Fire","latest_status":"Safe","latest_when":"12 min ago  ESTA","latest_where":"Acland St, St Kilda","message":"","n_damage":"2","n_fire":"5","n_flood":"4","n_total":"16","n_tree":"2","n_warn":"1","pill_w":40,"pill_x":272,"pill_y":212},
};

export default template;
