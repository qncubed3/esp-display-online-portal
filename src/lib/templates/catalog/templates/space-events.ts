import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Upcoming space events: dockings, flybys, spacewalks, press events (Launch Library 2)

const code = String.raw`// The next four space events (dockings, spacewalks, flybys, landings, press events),
// from The Space Devs' Launch Library 2. Keyless, but limited to 15 requests an hour per
// server, and events change slowly, so the cache is long.
// Countdowns and dates are worked out on every poll, in the Service owner's timezone.
const CACHE_S = 21600;
// "upcoming" also lists events from the last day or two, so ask for a few extra.
const URL = "https://ll.thespacedevs.com/2.3.0/events/upcoming/?limit=8&mode=list";

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
  return s.replace(/[\s,|:(-]+$/, "") + "...";
}
// Word-wrap s into at most two lines of max px; the second line gets "..." if cut.
function wrap2(s, max) {
  const words = s.split(" ");
  let a = "";
  while (words.length && width(a ? a + " " + words[0] : words[0]) <= max) a = a ? a + " " + words.shift() : words.shift();
  if (!a) return [fit(s, max), ""];
  return [a, words.length ? fit(words.join(" "), max) : ""];
}
// The fonts are ASCII only.
function ascii(s) {
  return String(s || "").normalize("NFD").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

// Offset of the owner's timezone from UTC, in ms (from now(), as there is no Intl here).
const nowMs = Date.now();
const local = Date.parse(now("YYYY-MM-DD") + "T" + now("HH:mm:ss") + "Z");
const tzOffset = Math.round((local - nowMs) / 60000) * 60000;
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => (n < 10 ? "0" : "") + n;
const dayNo = (ms) => Math.floor((ms + tzOffset) / 86400000); // local calendar day number

let events = [];
let failed = false;
try {
  const res = await get(URL, { cache: CACHE_S });
  events = (res && Array.isArray(res.results) ? res.results : []).filter((e) => e && e.date && e.name);
} catch (e) {
  failed = true;
  console.log("events fetch failed:", e.message);
}
// Drop events that finished more than two hours ago.
events = events
  .filter((e) => Date.parse(e.date) > nowMs - 2 * 3600000)
  .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  .slice(0, 4);

// Left column: a big number, its unit and the local date.
function when(e) {
  const t = Date.parse(e.date);
  const ms = t - nowMs;
  const prec = e.date_precision ? e.date_precision.id : 1; // 0-4 time known, 5 day, 6 week, 7+ month or vaguer
  const d = new Date(t + tzOffset);
  if (prec >= 7) return [MONTHS[d.getUTCMonth()], "NET", String(d.getUTCFullYear())];
  const date = DAYS[d.getUTCDay()] + " " + d.getUTCDate();
  const days = dayNo(t) - dayNo(nowMs);
  const approx = prec === 6 ? "~" : "";
  if (days >= 1) return [approx + days, days === 1 ? "DAY" : "DAYS", date];
  if (prec >= 5) return ["0", "TODAY", date];
  const clock = pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  if (ms <= 0) return ["NOW", "LIVE", clock];
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return [String(h), h === 1 ? "HOUR" : "HOURS", clock];
  return [String(Math.max(1, Math.floor(ms / 60000))), "MINS", clock];
}

const HIDE = -200;
const TEXT_X = 72, TEXT_W = 312 - TEXT_X;
const out = {};
for (let i = 0; i < 4; i++) {
  const e = events[i];
  const k = "e" + (i + 1) + "_";
  const top = 27 + i * 53;
  if (!e) {
    out[k + "num"] = ""; out[k + "unit"] = ""; out[k + "date"] = "";
    out[k + "l1"] = ""; out[k + "l2"] = ""; out[k + "sub"] = ""; out[k + "sub_y"] = HIDE;
    continue;
  }
  const w = when(e);
  out[k + "num"] = w[0]; out[k + "unit"] = w[1]; out[k + "date"] = w[2];
  const lines = wrap2(ascii(e.name), TEXT_W);
  out[k + "l1"] = lines[0]; out[k + "l2"] = lines[1];
  const type = ascii(e.type && e.type.name);
  const where = ascii(e.location).replace(/International Space Station/, "ISS");
  out[k + "sub"] = fit([type, where].filter(Boolean).join(" - ").toUpperCase(), TEXT_W);
  // Sub line sits under the name: lower when the name takes two lines.
  out[k + "sub_y"] = top + (lines[1] ? 38 : 24);
}

export const clock = now("HH:mm");
export const empty = events.length ? "" : failed ? "Launch Library unavailable" : "No upcoming events";
export const e1_num = out.e1_num, e1_unit = out.e1_unit, e1_date = out.e1_date, e1_l1 = out.e1_l1, e1_l2 = out.e1_l2, e1_sub = out.e1_sub, e1_sub_y = out.e1_sub_y;
export const e2_num = out.e2_num, e2_unit = out.e2_unit, e2_date = out.e2_date, e2_l1 = out.e2_l1, e2_l2 = out.e2_l2, e2_sub = out.e2_sub, e2_sub_y = out.e2_sub_y;
export const e3_num = out.e3_num, e3_unit = out.e3_unit, e3_date = out.e3_date, e3_l1 = out.e3_l1, e3_l2 = out.e3_l2, e3_sub = out.e3_sub, e3_sub_y = out.e3_sub_y;
export const e4_num = out.e4_num, e4_unit = out.e4_unit, e4_date = out.e4_date, e4_l1 = out.e4_l1, e4_l2 = out.e4_l2, e4_sub = out.e4_sub, e4_sub_y = out.e4_sub_y;
`;

// One event row (53 px): countdown number, unit and date on the left; name and type/place on the right.
function row(n: number): RawWireOp[] {
  const top = 27 + (n - 1) * 53;
  const e = "e" + n + "_";
  return [
    ["text", "{" + e + "num}", 34, top + 15, 4, 1, "MC", "#FFFFFF"],
    ["text", "{" + e + "unit}", 34, top + 31, 1, 1, "TC", "#B794F6"],
    ["text", "{" + e + "date}", 34, top + 42, 1, 1, "TC", "#8C97AB"],
    ["text", "{" + e + "l1}", 72, top + 5, 2, 1, "TL", "#FFFFFF"],
    ["text", "{" + e + "l2}", 72, top + 21, 2, 1, "TL", "#FFFFFF"],
    ["text", "{" + e + "sub}", 72, "{" + e + "sub_y}", 1, 1, "TL", "#8C97AB"],
  ];
}

const wire: RawWireOp[] = [
  ["fillScreen", "#05070D"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#161230"],
  ["text", "SPACE EVENTS", 8, 13, 2, 1, "ML", "#B794F6"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#A8B3C7"],
  // Left column divider and row separators
  ["drawFastVLine", 64, 32, 202, "#1C2436"],
  ["drawFastHLine", 8, 79, 304, "#1C2436"],
  ["drawFastHLine", 8, 132, 304, "#1C2436"],
  ["drawFastHLine", 8, 185, 304, "#1C2436"],
  ...row(1),
  ...row(2),
  ...row(3),
  ...row(4),
  // Shown only when there is nothing to list
  ["text", "{empty}", 160, 133, 2, 1, "MC", "#A8B3C7", "#05070D"],
];

const template: Template = {
  id: "space-events",
  name: "Upcoming space events",
  description: "The next four space events (dockings, spacewalks, flybys, landings, briefings) with a days-to-go countdown, type and place.",
  apis: ["Launch Library 2"],
  category: "space",
  dataCode: code,
  rows: rows("space-events", wire),
  sampleVars: {"clock":"01:28","e1_date":"04:05","e1_l1":"SpaceX CRS-35 Dragon Undocking","e1_l2":"","e1_num":"2","e1_sub":"SPACECRAFT UNDOCKING - ISS","e1_sub_y":51,"e1_unit":"HOURS","e2_date":"TUE 24","e2_l1":"NG-25 Prelaunch Media","e2_l2":"Teleconference","e2_num":"3","e2_sub":"PRESS EVENT - ONLINE","e2_sub_y":118,"e2_unit":"DAYS","e3_date":"2026","e3_l1":"BepiColombo Mercury Orbit Insertion","e3_l2":"","e3_num":"Nov","e3_sub":"ORBITAL INSERTION - MERCURY","e3_sub_y":157,"e3_unit":"NET","e4_date":"","e4_l1":"","e4_l2":"","e4_num":"","e4_sub":"","e4_sub_y":-200,"e4_unit":"","empty":""},
};

export default template;
