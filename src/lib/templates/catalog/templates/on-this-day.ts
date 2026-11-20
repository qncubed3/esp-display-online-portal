import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// On this day in history

const onThisDayCode = String.raw`// "On this day" events from Wikipedia, via history.muffinlabs.com (free, no key).
// One event is featured with its year in big type; which one rotates by hour, walking from
// the oldest events in the early hours to the most recent at night. Up to two more short
// events fill the space below. Text is word-wrapped here by pixel width, because Draw can't wrap.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = Number(now("MM"));
const day = Number(now("DD"));
const hour = Number(now("HH"));
const thisYear = Number(now("YYYY"));
export const date = now("ddd") + " " + day + " " + MONTHS[month - 1];

let events = [];
try {
  const res = await get("https://history.muffinlabs.com/date/" + month + "/" + day, { cache: 21600 });
  if (res && res.data && Array.isArray(res.data.Events)) events = res.data.Events;
} catch (e) {
  console.log("on this day failed:", e.message);
}

// Fonts are ASCII only: drop accents (e -> e), turn "²" into "2", straighten quotes and dashes.
const ascii = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Font 2 glyph widths (chars 32-126), so lines are wrapped to real pixels.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const c of s) w += W2[c.charCodeAt(0) - 32] || 8; return w; };
const wrap = (text, maxW) => {
  const lines = [];
  let line = "";
  for (const w of text.split(" ")) {
    const next = line ? line + " " + w : w;
    if (line && width(next) > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
};

const MAIN_W = 300, MAIN_LINES = 5, PITCH = 18;
const EXTRA_W = 256; // text column of the extra events, right of their year
// Only plain CE years can be featured big; the main text must fit in 5 lines.
const all = events
  .map((e) => ({ year: ascii(e.year), text: ascii(e.text) }))
  .filter((e) => e.text);
const featurable = all.filter((e) => /^\d{1,4}$/.test(e.year) && wrap(e.text, MAIN_W).length <= MAIN_LINES);

let main = { year: String(thisYear), text: "History is taking a break. Couldn't load today's events; trying again soon." };
let extras = [];
if (featurable.length) {
  const i = Math.floor((hour * featurable.length) / 24);
  main = featurable[i];
  // Extras: the next short events after the featured one (two lines at most each).
  const start = all.indexOf(main);
  for (let k = 1; k < all.length && extras.length < 2; k++) {
    const e = all[(start + k) % all.length];
    if (e !== main && /^\d{1,4}$/.test(e.year) && wrap(e.text, EXTRA_W).length <= 2) extras.push(e);
  }
}

// Main event: big year, "N years ago" beside it, then the wrapped text.
export const year = main.year;
const ago = thisYear - Number(main.year);
export const ago_line = featurable.length ? (ago === 1 ? "1 year ago" : ago + " years ago") : "";
export const ago_x = 10 + main.year.length * 28 + 10; // font 4 digits are 14 px, x2
const ml = wrap(main.text, MAIN_W).slice(0, MAIN_LINES);
export const m1 = ml[0] || "", m2 = ml[1] || "", m3 = ml[2] || "", m4 = ml[3] || "", m5 = ml[4] || "";
let y = 96 + ml.length * PITCH + 6;

// Divider and extras, each placed only if it fits above the footer (y 226).
const OFF = 400; // off-screen
const divAt = y;
y += 8;
const slot = (e) => {
  if (!e) return { yr: "", l1: "", l2: "", y: OFF };
  const lines = wrap(e.text, EXTRA_W);
  if (y + lines.length * PITCH - 2 > 226) return { yr: "", l1: "", l2: "", y: OFF };
  const out = { yr: e.year, l1: lines[0], l2: lines[1] || "", y };
  y += lines.length * PITCH + 4;
  return out;
};
const a = slot(extras[0]), b = slot(extras[1]);
export const div_y = a.y === OFF ? OFF : divAt;
export const a_year = a.yr, a1 = a.l1, a2 = a.l2, a_y = a.y, a_y2 = a.y + PITCH;
export const b_year = b.yr, b1 = b.l1, b2 = b.l2, b_y = b.y, b_y2 = b.y + PITCH;
`;

const onThisDayWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#0B3A4A"],
  ["text", "ON THIS DAY", 10, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{date}", 310, 14, 2, 1, "MR", "#9FD8E8"],
  // Featured event
  ["text", "{year}", 10, 36, 4, 2, "TL", "#FFC24A"],
  ["text", "{ago_line}", "{ago_x}", 84, 2, 1, "BL", "#8A9AA8"],
  ["text", "{m1}", 10, 96, 2, 1, "TL", "#FFFFFF"],
  ["text", "{m2}", 10, 114, 2, 1, "TL", "#FFFFFF"],
  ["text", "{m3}", 10, 132, 2, 1, "TL", "#FFFFFF"],
  ["text", "{m4}", 10, 150, 2, 1, "TL", "#FFFFFF"],
  ["text", "{m5}", 10, 168, 2, 1, "TL", "#FFFFFF"],
  // More events
  ["drawFastHLine", 10, "{div_y}", 300, "#2A4A58"],
  ["text", "{a_year}", 10, "{a_y}", 2, 1, "TL", "#FFC24A"],
  ["text", "{a1}", 54, "{a_y}", 2, 1, "TL", "#B8C4CC"],
  ["text", "{a2}", 54, "{a_y2}", 2, 1, "TL", "#B8C4CC"],
  ["text", "{b_year}", 10, "{b_y}", 2, 1, "TL", "#FFC24A"],
  ["text", "{b1}", 54, "{b_y}", 2, 1, "TL", "#B8C4CC"],
  ["text", "{b2}", 54, "{b_y2}", 2, 1, "TL", "#B8C4CC"],
  ["text", "Wikipedia via muffinlabs", 310, 236, 1, 1, "BR", "#5A6A74"],
];

const template: Template = {
  id: "on-this-day",
  name: "On this day",
  description: "A notable event from this date in history, with its year in big type; changes every hour.",
  apis: ["muffinlabs", "Wikipedia"],
  category: "world",
  dataCode: onThisDayCode,
  rows: rows("on-this-day", onThisDayWire),
  sampleVars: {"a1": "Claude Monet's paintings shown at", "a2": "Gallery Durand-Ruel in Paris.", "a_y": 146, "a_y2": 164, "a_year": "1900", "ago_line": "406 years ago", "ago_x": 132, "b1": "The first permanent ARPANET link is", "b2": "established between UCLA and SRI.", "b_y": 186, "b_y2": 204, "b_year": "1969", "date": "Sat 21 Nov", "div_y": 138, "m1": "Plymouth Colony settlers sign the Mayflower", "m2": "Compact (November 11, O.S.)", "m3": "", "m4": "", "m5": "", "year": "1620"},
};

export default template;
