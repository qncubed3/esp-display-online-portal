import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Open natural events tracked by NASA EONET: storms, volcanoes and wildfires

const dataCode = String.raw`// Open natural events from NASA EONET v3 (free, no key), two per category.
// Categories: severeStorms, volcanoes, wildfires (the sections in Draw).
const PER = 2; // events shown per section
const SKIP_PRESCRIBED = true; // prefer real wildfires over planned burns

const BASE = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=";
async function load(cat, limit) {
  try {
    const d = await get(BASE + cat + "&limit=" + limit, { cache: 3600 });
    return d && Array.isArray(d.events) ? d.events : null;
  } catch (e) {
    console.log("EONET " + cat + " failed:", e.message);
    return null;
  }
}
// Fetch all three at once: EONET can be slow and each get has a 5 s limit.
let [storms, volcs, fires] = await Promise.all([
  load("severeStorms", 4),
  load("volcanoes", 4),
  load("wildfires", 20),
]);
if (fires && SKIP_PRESCRIBED) {
  const real = fires.filter((e) => !/^prescribed/i.test(String(e.title || "")));
  fires = real.concat(fires.filter((e) => real.indexOf(e) < 0));
}

// Font 2 glyph widths (chars 32-126), to cut titles to the space they have.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const w2 = (s) => [...s].reduce((n, ch) => n + (W2[ch.charCodeAt(0) - 32] || 8), 0);
function fit(s, px) {
  if (w2(s) <= px) return s;
  while (s.length && w2(s + "..") > px) s = s.slice(0, -1);
  return s.trimEnd() + "..";
}
function ascii(s) {
  s = String(s || "");
  try { s = s.normalize("NFD"); } catch (e) {}
  return s.replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function day(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? +m[3] + " " + MON[+m[2] - 1] : "";
}
function num(v) {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function where(c) {
  if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") return "";
  return Math.abs(c[1]).toFixed(1) + (c[1] < 0 ? "S " : "N ") + Math.abs(c[0]).toFixed(1) + (c[0] < 0 ? "W" : "E");
}

function entry(list, i, cat) {
  if (!list) return i === 0 ? { t: "Feed unavailable", d: "", c: "" } : { t: "", d: "", c: "" };
  const e = list[i];
  if (!e) return i === 0 ? { t: "No open events", d: "", c: "" } : { t: "", d: "", c: "" };
  let title = ascii(e.title);
  if (cat === "fire") title = title.replace(/^Wildfire\s+/i, "").replace(/^Prescribed Fire\s+/i, "Rx ");
  const geo = Array.isArray(e.geometry) && e.geometry.length ? e.geometry[e.geometry.length - 1] : null;
  let d = geo ? "Updated " + day(geo.date) : "";
  if (geo && typeof geo.magnitudeValue === "number") {
    const unit = String(geo.magnitudeUnit || "");
    d += "  " + num(geo.magnitudeValue) + " " + (unit === "kts" ? "kts" : unit === "acres" ? "acres" : ascii(unit));
  }
  const c = geo && geo.type === "Point" ? where(geo.coordinates) : "";
  return { t: fit(title || "Unnamed event", 254), d: d, c: c };
}

const S = [0, 1].map((i) => i < PER ? entry(storms, i, "storm") : { t: "", d: "", c: "" });
const V = [0, 1].map((i) => i < PER ? entry(volcs, i, "volc") : { t: "", d: "", c: "" });
const F = [0, 1].map((i) => i < PER ? entry(fires, i, "fire") : { t: "", d: "", c: "" });

export const s1 = S[0].t, s1_d = S[0].d, s1_c = S[0].c;
export const s2 = S[1].t, s2_d = S[1].d, s2_c = S[1].c;
export const v1 = V[0].t, v1_d = V[0].d, v1_c = V[0].c;
export const v2 = V[1].t, v2_d = V[1].d, v2_c = V[1].c;
export const f1 = F[0].t, f1_d = F[0].d, f1_c = F[0].c;
export const f2 = F[1].t, f2_d = F[1].d, f2_c = F[1].c;
export const time = now("ddd HH:mm");
`;

const BG = "#000000";
const LINE = "#303030";
const STORM = "#4FC3F7";
const VOLC = "#FF7043";
const FIRE = "#FFB300";
const TOP = [31, 100, 169]; // top of each section

// One section: icon column on the left, two events on the right.
function section(sy: number, key: string, label: string, colour: string, icon: RawWireOp[]): RawWireOp[] {
  return [
    ...icon,
    ["text", label, 28, sy + 56, 1, 1, "MC", colour],
    ...[1, 2].flatMap((n): RawWireOp[] => {
      const y = sy + 3 + (n - 1) * 33;
      return [
        ["text", `{${key}${n}}`, 56, y, 2, 1, "TL", "#FFFFFF"],
        ["text", `{${key}${n}_d}`, 56, y + 19, 1, 1, "TL", "#A0A0A0"],
        ["text", `{${key}${n}_c}`, 312, y + 19, 1, 1, "TR", colour],
      ];
    }),
  ];
}

const [sa, sb, sc] = TOP;

const stormIcon: RawWireOp[] = [
  ["drawCircle", 28, sa + 24, 13, STORM],
  ["drawCircle", 28, sa + 24, 12, STORM],
  ["drawCircle", 28, sa + 24, 8, STORM],
  ["fillCircle", 28, sa + 24, 4, STORM],
  ["fillTriangle", 28, sa + 9, 40, sa + 11, 30, sa + 15, STORM],
  ["fillTriangle", 28, sa + 39, 16, sa + 37, 26, sa + 33, STORM],
];

const volcIcon: RawWireOp[] = [
  ["fillCircle", 30, sb + 7, 3, "#808080"],
  ["fillCircle", 35, sb + 3, 2, "#808080"],
  ["fillTriangle", 12, sb + 40, 44, sb + 40, 28, sb + 13, "#8D4A2B"],
  ["fillTriangle", 23, sb + 22, 33, sb + 22, 28, sb + 13, VOLC],
  ["fillRect", 25, sb + 12, 7, 3, VOLC],
];

const fireIcon: RawWireOp[] = [
  ["fillCircle", 28, sc + 31, 9, "#FF5722"],
  ["fillTriangle", 19, sc + 30, 37, sc + 30, 28, sc + 8, "#FF5722"],
  ["fillTriangle", 30, sc + 26, 37, sc + 30, 36, sc + 16, "#FF5722"],
  ["fillCircle", 28, sc + 34, 5, FIRE],
  ["fillTriangle", 23, sc + 33, 33, sc + 33, 28, sc + 20, FIRE],
];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A2433"],
  ["text", "NATURAL EVENTS", 8, 13, 2, 1, "ML", FIRE],
  ["text", "NASA EONET", 172, 13, 1, 1, "ML", "#8090A0"],
  ["text", "{time}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Section separators
  ["drawFastHLine", 8, sb - 3, 304, LINE],
  ["drawFastHLine", 8, sc - 3, 304, LINE],
  ...section(sa, "s", "STORMS", STORM, stormIcon),
  ...section(sb, "v", "VOLCANO", VOLC, volcIcon),
  ...section(sc, "f", "FIRES", FIRE, fireIcon),
];

const template: Template = {
  id: "natural-events",
  name: "NASA natural events",
  description: "Open severe storms, volcanoes and wildfires tracked by NASA EONET, with date, strength and position.",
  apis: ["NASA EONET"],
  category: "science",
  dataCode,
  rows: rows("natural-events", wire),
  sampleVars: {"f1":"Range 47, Forrest, Mississippi","f1_c":"31.1N 89.2W","f1_d":"Updated 13 Nov  2,379 acres","f2":"201W, Perry, Mississippi","f2_c":"31.1N 89.1W","f2_d":"Updated 13 Nov  2,700 acres","s1":"Tropical Cyclone Akvan","s1_c":"17.2N 84.7E","s1_d":"Updated 19 Nov  30 kts","s2":"Tropical Cyclone Xavier","s2_c":"11.0S 162.8W","s2_d":"Updated 20 Nov  90 kts","time":"Sat 01:22","v1":"Nevados del Chillan Volcano, Chile","v1_c":"36.9S 71.4W","v1_d":"Updated 15 Jun","v2":"Telica Volcano, Nicaragua","v2_c":"12.6N 86.8W","v2_d":"Updated 30 May"},
};

export default template;
