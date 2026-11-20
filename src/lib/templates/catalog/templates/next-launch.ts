import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Next rocket launch (Launch Library 2)

const code = String.raw`// The next rocket launch worldwide, with a countdown, from The Space Devs' Launch Library 2.
// Keyless, but limited to 15 requests an hour per server, so keep the cache at 900 s or more.
// The countdown is worked out on every poll from the NET (no-earlier-than) time.
const CACHE_S = 900;
const URL = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=3&mode=normal&hide_recent_previous=true";

// Text widths at size 1 for chars 32-126 (from TFT_eSPI fonts 2 and 4), to fit text in Data.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
function width(s, w) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n += w[s.charCodeAt(i) - 32] || 0;
  return n;
}
// Cut s to fit max px, adding "..." when it's cut.
function fit(s, w, max) {
  if (width(s, w) <= max) return s;
  while (s.length && width(s + "...", w) > max) s = s.slice(0, -1);
  return s.replace(/[\s,|-]+$/, "") + "...";
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
function localDate(ms, withDay) {
  const d = new Date(ms + tzOffset);
  const hm = pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  return DAYS[d.getUTCDay()] + (withDay ? " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] : "") + " " + hm;
}

// Status id -> pill label, pill colour, text colour.
const STATUS = {
  1: ["GO", "#22C55E", "#000000"],
  2: ["TBD", "#9CA3AF", "#000000"],
  3: ["SUCCESS", "#22C55E", "#000000"],
  4: ["FAILURE", "#EF4444", "#FFFFFF"],
  5: ["HOLD", "#EF4444", "#FFFFFF"],
  6: ["IN FLIGHT", "#38BDF8", "#000000"],
  7: ["PARTIAL FAIL", "#F97316", "#000000"],
  8: ["TBC", "#F59E0B", "#000000"],
};

let launches = [];
try {
  const res = await get(URL, { cache: CACHE_S });
  launches = (res && Array.isArray(res.results) ? res.results : []).filter((l) => l && l.net);
} catch (e) {
  console.log("launch fetch failed:", e.message);
}
// Skip anything that has already flown or whose NET passed more than an hour ago.
const upcoming = launches.filter((l) => {
  const sid = l.status && l.status.id;
  return sid !== 3 && sid !== 4 && sid !== 7 && Date.parse(l.net) > nowMs - 3600000;
});
const first = upcoming[0];
const second = upcoming[1];

function rocketOf(l, short) {
  const c = l.rocket && l.rocket.configuration;
  return ascii((c && (short ? c.name : c.full_name || c.name)) || String(l.name || "").split("|")[0]);
}
function missionOf(l) {
  return ascii((l.mission && l.mission.name) || String(l.name || "").split("|").pop());
}
function providerOf(l) {
  const p = l.launch_service_provider || {};
  const name = ascii(p.name);
  return name.length > 18 && p.abbrev ? ascii(p.abbrev) : name;
}
function placeOf(l) {
  const p = l.pad || {};
  const pad = ascii(p.name)
    .replace(/^Space Launch Complex /, "SLC-")
    .replace(/^Launch Complex /, "LC-")
    .replace(/^Launch Area /, "LA-");
  const loc = ascii(p.location && p.location.name).replace(/People's Republic of China/, "China");
  return [pad, loc].filter(Boolean).join(", ");
}
function countdown(l) {
  const ms = Date.parse(l.net) - nowMs;
  const prec = l.net_precision ? l.net_precision.id : 1;
  if (ms <= 0) return "T-0";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (prec >= 5) return "T-" + Math.max(d, 1) + "d"; // only known to the day or worse
  if (d > 0) return "T-" + d + "d " + pad2(h) + ":" + pad2(m);
  return h > 0 ? "T-" + h + "h " + pad2(m) + "m" : "T-" + m + "m";
}

const HIDE = -200;
let mission = "No launch data", rocket = "Launch Library unavailable", place = "", count = "T- --";
let st = null, date = "";
if (first) {
  mission = fit(missionOf(first), W4, 304);
  rocket = fit(rocketOf(first) + " - " + providerOf(first), W2, 304);
  place = fit(placeOf(first), W2, 304);
  count = countdown(first);
  st = STATUS[first.status && first.status.id] ||
    [ascii(first.status && first.status.abbrev).toUpperCase() || "?", "#9CA3AF", "#000000"];
  date = localDate(Date.parse(first.net), true);
}

// Status pill and NET date, centred together under the countdown.
const pillW = st ? width(st[0], W2) + 20 : 0;
const dateW = width(date, W2);
const rowX = Math.round(160 - (pillW + (st ? 10 : 0) + dateW) / 2);

export const clock = now("HH:mm");
export { mission, rocket, place, count, date };
export const pill = st ? st[0] : "";
export const pill_bg = st ? st[1] : "#000000";
export const pill_fg = st ? st[2] : "#000000";
export const pill_x = st ? rowX : HIDE;
export const pill_w = pillW;
export const pill_cx = rowX + Math.round(pillW / 2);
export const date_x = rowX + pillW + (st ? 10 : 0);

// The launch after that, as one small line.
let afterWhen = "", after = first ? "No later launch listed" : "";
if (second) {
  afterWhen = localDate(Date.parse(second.net), false);
  after = fit(rocketOf(second, true) + " | " + missionOf(second), W2, 304 - 40 - width(afterWhen, W2) - 12);
}
export { after, afterWhen as after_when };
export const after_label = first ? "THEN" : "";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#05070D"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#141B2D"],
  ["text", "NEXT LAUNCH", 8, 13, 2, 1, "ML", "#FF9A3C"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#A8B3C7"],
  // Mission, rocket and provider, pad and location
  ["text", "{mission}", 8, 34, 4, 1, "TL", "#FFFFFF"],
  ["text", "{rocket}", 8, 64, 2, 1, "TL", "#D6DEEB"],
  ["text", "{place}", 8, 82, 2, 1, "TL", "#8C97AB"],
  // Countdown
  ["text", "{count}", 160, 132, 4, 2, "MC", "#FFFFFF"],
  // Status pill and NET date
  ["fillRoundRect", "{pill_x}", 166, "{pill_w}", 22, 11, "{pill_bg}"],
  ["text", "{pill}", "{pill_cx}", 177, 2, 1, "MC", "{pill_fg}"],
  ["text", "{date}", "{date_x}", 177, 2, 1, "ML", "#D6DEEB"],
  // The launch after
  ["fillRect", 0, 202, 320, 38, "#141B2D"],
  ["text", "{after_label}", 8, 221, 1, 1, "ML", "#FF9A3C"],
  ["text", "{after}", 40, 221, 2, 1, "ML", "#D6DEEB"],
  ["text", "{after_when}", 312, 221, 2, 1, "MR", "#A8B3C7"],
];

const template: Template = {
  id: "next-launch",
  name: "Next rocket launch",
  description: "The next rocket launch worldwide: mission, rocket, pad, a T-minus countdown and Go/TBC status, plus the one after.",
  apis: ["Launch Library 2"],
  category: "space",
  dataCode: code,
  rows: rows("next-launch", wire),
  sampleVars: {"after": "Long March 6C | Unknown P...", "after_label": "THEN", "after_when": "Sat 14:50", "clock": "01:02", "count": "T-12h 29m", "date": "Sat 21 Nov 13:32", "date_x": 127, "mission": "USSF-317", "pill": "GO", "pill_bg": "#22C55E", "pill_cx": 99, "pill_fg": "#000000", "pill_w": 36, "pill_x": 81, "place": "SLC-4E, Vandenberg SFB, CA, USA", "rocket": "Falcon 9 Block 5 - SpaceX"},
};

export default template;
