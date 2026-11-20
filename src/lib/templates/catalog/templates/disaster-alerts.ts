import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Global disaster alerts (GDACS): the six latest orange and red alerts,
// red first, each with a type badge, a short title, the date and the countries.

const TOP = 30; // y of the first row
const ROW = 34; // row height

const code = String.raw`// The latest orange and red disaster alerts worldwide from GDACS (free, no key).
// Types: EQ earthquake, TC tropical cyclone, FL flood, VO volcano, WF wildfire, DR drought.
// Drop types from TYPES to hide them, e.g. "EQ;TC;VO".
const TYPES = "EQ;TC;FL;VO;WF;DR";
const ROWS = 6;
const TOP = ${TOP}, ROW = ${ROW}; // keep in step with Draw
const HIDE = -200; // y for a badge that should not show

let feed = null;
try {
  feed = await get("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=" + TYPES + "&alertlevel=Orange;Red", { cache: 1800 });
} catch (e) {
  console.log("GDACS failed:", e.message);
}
if (!feed || typeof feed !== "object" || !Array.isArray(feed.features)) feed = null;
const events = feed ? feed.features.map((f) => f && f.properties).filter((p) => p && p.eventtype) : [];

// Font 2 glyph widths (chars 32-126), to cut text to the space it has.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const w2 = (s) => [...s].reduce((n, ch) => n + (W2[ch.charCodeAt(0) - 32] || 8), 0);
function fit(s, px) {
  if (w2(s) <= px) return s;
  while (s.length && w2(s + "..") > px) s = s.slice(0, -1);
  return s.trimEnd() + "..";
}
// ASCII only: strip accents, drop anything else the font can't draw.
function ascii(s) {
  let t = String(s || "");
  try { t = t.normalize("NFD"); } catch (e) {}
  return t.replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim();
}

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function day(tag) {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(tag || ""));
  return m ? m[3] + " " + MON[parseInt(m[2], 10) - 1] : "";
}
const stamp = (tag) => Date.parse(String(tag || "") + "Z") || 0;
const start = (p) => stamp(p.fromdate || p.todate); // when the alert began
const last = (p) => stamp(p.todate || p.fromdate); // latest update

function title(p) {
  const name = ascii(p.name);
  const sev = p.severitydata || {};
  const text = String(sev.severitytext || "");
  switch (p.eventtype) {
    case "EQ":
      return typeof sev.severity === "number" ? "Earthquake M" + sev.severity.toFixed(1) : "Earthquake";
    case "TC": {
      const n = ascii(p.eventname) || name.replace(/^Tropical Cyclone\s*/i, "");
      const kmh = /(\d+)\s*km\/h/.exec(text);
      return "Cyclone " + n + (kmh ? " " + kmh[1] + " km/h" : "");
    }
    case "FL": return "Flood";
    case "VO": return "Eruption " + name.replace(/^Eruption\s*/i, "");
    case "WF": {
      const ha = /([\d.]+)\s*ha/.exec(text);
      return "Wildfire" + (ha ? " " + Math.round(parseFloat(ha[1])).toLocaleString("en-US") + " ha" : "");
    }
    case "DR": return "Drought";
    default: return name || p.eventtype;
  }
}

function places(p) {
  let list = Array.isArray(p.affectedcountries) ? p.affectedcountries.map((c) => ascii(c && c.countryname)).filter(Boolean) : [];
  if (!list.length) list = ascii(p.country).split(",").map((s) => s.trim()).filter(Boolean);
  list = list.filter((c, i) => list.indexOf(c) === i);
  if (!list.length) return "Unknown area";
  if (list.length <= 2) return list.join(", ");
  return list[0] + ", " + list[1] + " +" + (list.length - 2) + " more";
}

// The newest alerts by start date (so months-long droughts don't crowd the list),
// then red before orange.
const isRed = (p) => String(p.alertlevel).toLowerCase() === "red";
const recent = events.slice().sort((a, b) => start(b) - start(a)).slice(0, ROWS);
recent.sort((a, b) => (isRed(b) ? 1 : 0) - (isRed(a) ? 1 : 0) || start(b) - start(a));

function row(i) {
  const p = recent[i];
  if (!p) return { y: HIDE, type: "", col: "#000000", title: "", date: "", place: "" };
  const date = day(p.fromdate || p.todate);
  return {
    y: TOP + i * ROW,
    type: String(p.eventtype).slice(0, 2),
    col: isRed(p) ? "#E53935" : "#FF8C1A",
    title: fit(title(p), 262 - 8 - w2(date)),
    date: date,
    place: fit(places(p), 262),
  };
}
const r = [0, 1, 2, 3, 4, 5].map(row);
export const y1 = r[0].y, type1 = r[0].type, col1 = r[0].col, title1 = r[0].title, date1 = r[0].date, place1 = r[0].place;
export const y2 = r[1].y, type2 = r[1].type, col2 = r[1].col, title2 = r[1].title, date2 = r[1].date, place2 = r[1].place;
export const y3 = r[2].y, type3 = r[2].type, col3 = r[2].col, title3 = r[2].title, date3 = r[2].date, place3 = r[2].place;
export const y4 = r[3].y, type4 = r[3].type, col4 = r[3].col, title4 = r[3].title, date4 = r[3].date, place4 = r[3].place;
export const y5 = r[4].y, type5 = r[4].type, col5 = r[4].col, title5 = r[4].title, date5 = r[4].date, place5 = r[4].place;
export const y6 = r[5].y, type6 = r[5].type, col6 = r[5].col, title6 = r[5].title, date6 = r[5].date, place6 = r[5].place;

// Header: how many red alerts in the last 30 days.
const month = events.filter((p) => isRed(p) && Date.now() - last(p) < 30 * 86400000).length;
export const header_right = feed ? month + " red in 30 days" : "";
export const message = !feed ? "GDACS feed unavailable" : events.length ? "" : "No orange or red alerts";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#2A1A10"],
  ["text", "DISASTER ALERTS", 8, 13, 2, 1, "ML", "#FF8C1A"],
  ["text", "{header_right}", 312, 13, 2, 1, "MR", "#C0C0C0"],
  // Row separators
  ...[1, 2, 3, 4, 5].map((n): RawWireOp => ["drawFastHLine", 50, TOP + n * ROW - 2, 262, "#303030"]),
  // Alerts: level-coloured type badge, title and date, countries
  ...[1, 2, 3, 4, 5, 6].flatMap((n): RawWireOp[] => {
    const y = TOP + (n - 1) * ROW;
    return [
      ["fillRoundRect", 8, `{y${n}}`, 34, 30, 5, `{col${n}}`],
      ["text", `{type${n}}`, 25, y + 15, 2, 1, "MC", "#000000"],
      ["text", `{title${n}}`, 50, y, 2, 1, "TL", "#FFFFFF"],
      ["text", `{date${n}}`, 312, y, 2, 1, "TR", "#909090"],
      ["text", `{place${n}}`, 50, y + 16, 2, 1, "TL", "#A0A0A0"],
    ];
  }),
  ["text", "{message}", 160, 130, 2, 1, "MC", "#FF5A5F"],
];

const template: Template = {
  id: "disaster-alerts",
  name: "Global disaster alerts",
  description: "The six latest orange and red GDACS alerts worldwide (quakes, cyclones, floods, volcanoes, wildfires, droughts), red first.",
  apis: ["GDACS"],
  category: "world",
  dataCode: code,
  rows: rows("disaster-alerts", wire),
  sampleVars: {"col1":"#E53935","col2":"#E53935","col3":"#E53935","col4":"#FF8C1A","col5":"#FF8C1A","col6":"#FF8C1A","date1":"01 Nov","date2":"26 Oct","date3":"14 Oct","date4":"22 Oct","date5":"10 Oct","date6":"09 Oct","header_right":"3 red in 30 days","message":"","place1":"India","place2":"India","place3":"Philippines, Guam +3 more","place4":"China","place5":"Philippines","place6":"Panama","title1":"Cyclone MURASU-26 157 km/h","title2":"Cyclone ARNAB-26 222 km/h","title3":"Cyclone CHAMPI-26 296 km/h","title4":"Earthquake M7.0","title5":"Eruption Kanlaon","title6":"Earthquake M7.7","type1":"TC","type2":"TC","type3":"TC","type4":"EQ","type5":"VO","type6":"EQ","y1":30,"y2":64,"y3":98,"y4":132,"y5":166,"y6":200},
};

export default template;
