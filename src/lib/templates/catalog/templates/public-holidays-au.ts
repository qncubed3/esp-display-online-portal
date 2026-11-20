import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Days until the next Victorian public holiday, plus the ones after it (Nager.Date, keyless)

const holidaysCode = String.raw`// Next public holidays in Victoria, Australia, from Nager.Date (free, no key).
// Change STATE to another region code (AU-NSW, AU-QLD, ...) to follow a different state.
const STATE = "AU-VIC";
const STATE_LABEL = "VIC";
const LIST_ROWS = 4; // holidays listed under the big countdown

const today = now("YYYY-MM-DD");
const year = Number(today.slice(0, 4));

// Holidays that apply to STATE: national ones plus those whose counties include it.
function forState(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((h) => h && typeof h.date === "string" && (h.global || (Array.isArray(h.counties) && h.counties.includes(STATE))));
}

let all = [];
try {
  all = forState(await get("https://date.nager.at/api/v3/NextPublicHolidays/AU", { cache: 21600 }));
} catch (e) {
  console.log("NextPublicHolidays failed:", e.message);
}
// Fallback (or top-up): this year's and next year's full lists.
if (all.filter((h) => h.date >= today).length < LIST_ROWS + 1) {
  for (const y of [year, year + 1]) {
    try {
      all = all.concat(forState(await get("https://date.nager.at/api/v3/PublicHolidays/" + y + "/AU", { cache: 21600 })));
    } catch (e) {
      console.log("PublicHolidays " + y + " failed:", e.message);
    }
  }
}

// Fonts are ASCII only; also shorten a few long official names.
const clean = (s) =>
  String(s || "Holiday")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/^Friday before (the )?AFL Grand Final/i, "AFL Grand Final Friday")
    .replace(/\s*\(Tentative Date\)/i, " (TBC)")
    .trim();

// Upcoming (today counts), one entry per date + name, sorted by date.
const seen = {};
const upcoming = all
  .filter((h) => h.date >= today)
  .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  .filter((h) => {
    const k = h.date + "|" + (h.localName || h.name);
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });

const ymd = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const daysUntil = (s) => Math.round((ymd(s) - ymd(today)) / 86400000);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dow = (s) => new Date(ymd(s)).getUTCDay();

// Pixel widths of chars 32-127 in font 2 and font 4, so names can be wrapped and trimmed to fit.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15,1];
const width = (s, w) => {
  let n = 0;
  for (const c of s) n += w[c.charCodeAt(0) - 32] || 8;
  return n;
};
const fit = (s, w, max) => {
  if (width(s, w) <= max) return s;
  while (s.length > 1 && width(s + "...", w) > max) s = s.slice(0, -1);
  return s.trimEnd() + "...";
};

// ---- Header
export const header_right = STATE_LABEL + "  " + DAYS[dow(today)] + " " + today.slice(8, 10) + " " + MONTHS[Number(today.slice(5, 7)) - 1];

// ---- Hero: the next holiday
const NAME_MAX = 186; // px, right of the countdown (x 126 to 312)
const next = upcoming[0];
// Word-wrap the name into at most two lines of font 4.
let lines = [""];
for (const w of (next ? clean(next.localName || next.name) : "Holidays unavailable").split(" ")) {
  const cur = lines[lines.length - 1];
  const tryLine = cur ? cur + " " + w : w;
  if (!cur || width(tryLine, W4) <= NAME_MAX) lines[lines.length - 1] = tryLine;
  else lines.push(w);
}
if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
lines = lines.map((l) => fit(l, W4, NAME_MAX));
const days = next ? daysUntil(next.date) : -1;
export const big = days < 0 ? "--" : String(days);
export const big_size = big.length >= 3 ? 2 : 3;
export const big_label = days < 0 ? "NO DATA" : days === 0 ? "IT'S TODAY!" : days === 1 ? "DAY TO GO" : "DAYS TO GO";
export const name1 = lines[0];
export const name2 = lines[1] || "";
export const when = next
  ? DAYS_LONG[dow(next.date)] + " " + Number(next.date.slice(8, 10)) + " " + MONTHS_LONG[Number(next.date.slice(5, 7)) - 1]
  : "Will retry shortly";
// Centre the name + date block on the countdown (y 88).
const blockH = lines.length * 28 + 20;
const top = Math.round(88 - blockH / 2);
export const name1_y = top;
export const name2_y = lines.length > 1 ? top + 28 : -100;
export const when_y = top + lines.length * 28 + 4;

// ---- List: the ones after it
const LIST_NAME_MAX = 176; // px, x 92 to 268
const rest = upcoming.slice(1, 1 + LIST_ROWS);
function row(i) {
  const h = rest[i];
  if (!h) return { d: "", n: "", in: "" };
  return {
    d: DAYS[dow(h.date)] + " " + h.date.slice(8, 10) + " " + MONTHS[Number(h.date.slice(5, 7)) - 1],
    n: fit(clean(h.localName || h.name), W2, LIST_NAME_MAX),
    in: daysUntil(h.date) + "d",
  };
}
const r1 = row(0), r2 = row(1), r3 = row(2), r4 = row(3);
export const d1 = r1.d, n1 = r1.n, in1 = r1.in;
export const d2 = r2.d, n2 = r2.n, in2 = r2.in;
export const d3 = r3.d, n3 = r3.n, in3 = r3.in;
export const d4 = r4.d, n4 = r4.n, in4 = r4.in;
`;

const GOLD = "#FFCD00";
const holidaysWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#00502A"],
  ["text", "PUBLIC HOLIDAYS", 8, 13, 2, 1, "ML", GOLD],
  ["text", "{header_right}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Countdown
  ["text", "{big}", 62, 80, 4, "{big_size}", "MC", GOLD],
  ["text", "{big_label}", 62, 124, 2, 1, "TC", "#C8C8C8"],
  ["drawFastVLine", 122, 40, 98, "#404040"],
  // Next holiday: name (1-2 lines) and date
  ["text", "{name1}", 130, "{name1_y}", 4, 1, "TL", "#FFFFFF"],
  ["text", "{name2}", 130, "{name2_y}", 4, 1, "TL", "#FFFFFF"],
  ["text", "{when}", 130, "{when_y}", 2, 1, "TL", GOLD],
  // Following holidays
  ["fillRect", 0, 150, 320, 1, "#00803F"],
  ...[1, 2, 3, 4].flatMap((n): RawWireOp[] => {
    const y = 157 + (n - 1) * 20;
    return [
      ["text", `{d${n}}`, 8, y, 2, 1, "TL", "#B0B0B0"],
      ["text", `{n${n}}`, 92, y, 2, 1, "TL", "#FFFFFF"],
      ["text", `{in${n}}`, 312, y, 2, 1, "TR", GOLD],
    ];
  }),
];

const template: Template = {
  id: "public-holidays-au",
  name: "Public holidays (VIC)",
  description: "Big countdown to the next Victorian public holiday, with the four after it.",
  apis: ["Nager.Date"],
  category: "world",
  dataCode: holidaysCode,
  rows: rows("public-holidays-au", holidaysWire),
  sampleVars: {"big": "34", "big_label": "DAYS TO GO", "big_size": 3, "d1": "Mon 28 Dec", "d2": "Fri 01 Jan", "d3": "Tue 26 Jan", "d4": "Mon 08 Mar", "header_right": "VIC  Sat 21 Nov", "in1": "37d", "in2": "41d", "in3": "66d", "in4": "107d", "n1": "Boxing Day", "n2": "New Year's Day", "n3": "Australia Day", "n4": "Labour Day", "name1": "Christmas Day", "name1_y": 64, "name2": "", "name2_y": -100, "when": "Friday 25 December", "when_y": 96},
};

export default template;
