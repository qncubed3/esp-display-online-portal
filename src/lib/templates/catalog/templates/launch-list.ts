import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Launch schedule: the next five rocket launches worldwide (Launch Library 2)

const code = String.raw`// The next five rocket launches worldwide, from The Space Devs' Launch Library 2.
// Keyless, but limited to 15 requests an hour per server, so keep the cache at 1800 s or more.
// Dates and times are shown in the Service owner's timezone.
const CACHE_S = 3600;
const URL = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=5&mode=list";

// Text widths at size 1 for chars 32-126 (TFT_eSPI font 2), to fit text in Data.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
function width(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n += W2[s.charCodeAt(i) - 32] || 0;
  return n;
}
// Cut s to fit max px, adding "..." when it's cut.
function fit(s, max) {
  if (width(s) <= max) return s;
  while (s.length && width(s + "...") > max) s = s.slice(0, -1);
  return s.replace(/[\s,|(-]+$/, "") + "...";
}
// The fonts are ASCII only.
function ascii(s) {
  return String(s || "").normalize("NFD").replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").trim();
}

// Offset of the owner's timezone from UTC, in ms (from now(), as there is no Intl here).
const nowMs = Date.now();
const local = Date.parse(now("YYYY-MM-DD") + "T" + now("HH:mm:ss") + "Z");
const tzOffset = Math.round((local - nowMs) / 60000) * 60000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => (n < 10 ? "0" : "") + n;

// Status id -> label and dot colour.
const STATUS = {
  1: ["GO", "#22C55E"],
  2: ["TBD", "#9CA3AF"],
  5: ["HOLD", "#EF4444"],
  6: ["IN FLIGHT", "#38BDF8"],
  8: ["TBC", "#F59E0B"],
};

let launches = [];
let failed = false;
try {
  const res = await get(URL, { cache: CACHE_S });
  launches = (res && Array.isArray(res.results) ? res.results : []).filter((l) => l && l.net);
} catch (e) {
  failed = true;
  console.log("launch fetch failed:", e.message);
}
// Drop launches that have finished (success, failure, partial failure) or whose NET is long past.
launches = launches.filter((l) => {
  const sid = l.status && l.status.id;
  return sid !== 3 && sid !== 4 && sid !== 7 && Date.parse(l.net) > nowMs - 6 * 3600000;
}).slice(0, 5);

const HIDE = -200;
const TEXT_X = 78, RIGHT = 312;
const out = {};
for (let i = 0; i < 5; i++) {
  const l = launches[i];
  const k = "r" + (i + 1) + "_";
  if (!l) {
    out[k + "day"] = ""; out[k + "time"] = ""; out[k + "rocket"] = ""; out[k + "mission"] = "";
    out[k + "status"] = ""; out[k + "dot"] = "#000000"; out[k + "dot_y"] = HIDE;
    continue;
  }
  const parts = ascii(l.name).split("|").map((s) => s.trim());
  const rocket = parts[0] || "Unknown rocket";
  const mission = parts.length > 1 ? parts.slice(1).join(" | ") : "";
  const st = STATUS[l.status && l.status.id] ||
    [ascii(l.status && l.status.abbrev).toUpperCase() || "?", "#9CA3AF"];
  const prec = l.net_precision ? l.net_precision.id : 1;
  const d = new Date(Date.parse(l.net) + tzOffset);
  // Precision: 0-4 time is known, 5-6 day or week, 7+ month or vaguer.
  if (prec >= 7) {
    out[k + "day"] = MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear().toString().slice(2);
    out[k + "time"] = "NET";
  } else {
    out[k + "day"] = DAYS[d.getUTCDay()] + " " + d.getUTCDate();
    out[k + "time"] = prec >= 5 ? "--:--" : pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  }
  out[k + "status"] = st[0];
  out[k + "dot"] = st[1];
  out[k + "dot_y"] = 28 + i * 42 + 21;
  out[k + "rocket"] = fit(rocket, RIGHT - TEXT_X - st[0].length * 6 - 8);
  out[k + "mission"] = fit(mission, RIGHT - TEXT_X);
}

export const clock = now("HH:mm");
export const empty = launches.length ? "" : failed ? "Launch Library unavailable" : "No upcoming launches";
export const r1_day = out.r1_day, r1_time = out.r1_time, r1_rocket = out.r1_rocket, r1_mission = out.r1_mission, r1_status = out.r1_status, r1_dot = out.r1_dot, r1_dot_y = out.r1_dot_y;
export const r2_day = out.r2_day, r2_time = out.r2_time, r2_rocket = out.r2_rocket, r2_mission = out.r2_mission, r2_status = out.r2_status, r2_dot = out.r2_dot, r2_dot_y = out.r2_dot_y;
export const r3_day = out.r3_day, r3_time = out.r3_time, r3_rocket = out.r3_rocket, r3_mission = out.r3_mission, r3_status = out.r3_status, r3_dot = out.r3_dot, r3_dot_y = out.r3_dot_y;
export const r4_day = out.r4_day, r4_time = out.r4_time, r4_rocket = out.r4_rocket, r4_mission = out.r4_mission, r4_status = out.r4_status, r4_dot = out.r4_dot, r4_dot_y = out.r4_dot_y;
export const r5_day = out.r5_day, r5_time = out.r5_time, r5_rocket = out.r5_rocket, r5_mission = out.r5_mission, r5_status = out.r5_status, r5_dot = out.r5_dot, r5_dot_y = out.r5_dot_y;
`;

// One launch row: date and time on the left, a status dot, rocket and status label, then the mission.
function row(n: number): RawWireOp[] {
  const top = 28 + (n - 1) * 42;
  const r = "r" + n + "_";
  return [
    ["text", "{" + r + "day}", 8, top + 5, 2, 1, "TL", "#D6DEEB"],
    ["text", "{" + r + "time}", 8, top + 22, 2, 1, "TL", "#FF9A3C"],
    ["fillCircle", 66, "{" + r + "dot_y}", 4, "{" + r + "dot}"],
    ["text", "{" + r + "rocket}", 78, top + 5, 2, 1, "TL", "#FFFFFF"],
    ["text", "{" + r + "status}", 312, top + 9, 1, 1, "TR", "{" + r + "dot}"],
    ["text", "{" + r + "mission}", 78, top + 22, 2, 1, "TL", "#8C97AB"],
  ];
}

const wire: RawWireOp[] = [
  ["fillScreen", "#05070D"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#141B2D"],
  ["text", "LAUNCH SCHEDULE", 8, 13, 2, 1, "ML", "#FF9A3C"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#A8B3C7"],
  // Row separators
  ["drawFastHLine", 8, 70, 304, "#1C2436"],
  ["drawFastHLine", 8, 112, 304, "#1C2436"],
  ["drawFastHLine", 8, 154, 304, "#1C2436"],
  ["drawFastHLine", 8, 196, 304, "#1C2436"],
  ...row(1),
  ...row(2),
  ...row(3),
  ...row(4),
  ...row(5),
  // Shown only when there is nothing to list
  ["text", "{empty}", 160, 133, 2, 1, "MC", "#A8B3C7"],
];

const template: Template = {
  id: "launch-list",
  name: "Launch schedule",
  description: "The next five rocket launches worldwide, with local date and time, rocket, mission and a Go/TBC/TBD status dot.",
  apis: ["Launch Library 2"],
  category: "space",
  dataCode: code,
  rows: rows("launch-list", wire),
  sampleVars: {"clock":"01:27","empty":"","r1_day":"Fri 20","r1_dot":"#38BDF8","r1_dot_y":49,"r1_mission":"SatNet LEO Group TBD?","r1_rocket":"Long March 8A","r1_status":"IN FLIGHT","r1_time":"22:59","r2_day":"Sat 21","r2_dot":"#22C55E","r2_dot_y":91,"r2_mission":"USSF-317","r2_rocket":"Falcon 9 Block 5","r2_status":"GO","r2_time":"13:32","r3_day":"Sat 21","r3_dot":"#22C55E","r3_dot_y":133,"r3_mission":"Unknown Payload","r3_rocket":"Long March 6C","r3_status":"GO","r3_time":"14:50","r4_day":"Sat 21","r4_dot":"#22C55E","r4_dot_y":175,"r4_mission":"NROL-136","r4_rocket":"Falcon 9 Block 5","r4_status":"GO","r4_time":"23:30","r5_day":"Mon 23","r5_dot":"#22C55E","r5_dot_y":217,"r5_mission":"Amazon Leo (LE-04)","r5_rocket":"Ariane 64 Block 2","r5_status":"GO","r5_time":"22:09"},
};

export default template;
