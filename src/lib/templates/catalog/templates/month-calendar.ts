import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// A Monday-first month grid with today boxed and Victorian public holidays in red (Nager.Date, keyless)

const code = String.raw`// This month as a calendar grid, with public holidays from Nager.Date (free, no key).
// Change STATE to another region code (AU-NSW, AU-QLD, ...) to mark a different state's holidays.
const STATE = "AU-VIC";
const STATE_LABEL = "VIC";

const today = now("YYYY-MM-DD");
const year = Number(today.slice(0, 4));
const month = Number(today.slice(5, 7)); // 1-12
const day = Number(today.slice(8, 10));

const pad = (n) => (n < 10 ? "0" : "") + n;
const key = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
const ymd = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

// Holidays that apply to STATE: national ones plus those whose counties include it.
function forState(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((h) => h && typeof h.date === "string" && (h.global || (Array.isArray(h.counties) && h.counties.includes(STATE))));
}
let holidays = [];
let ok = false;
try {
  holidays = forState(await get("https://date.nager.at/api/v3/PublicHolidays/" + year + "/AU", { cache: 86400 }));
  ok = true;
} catch (e) {
  console.log("PublicHolidays " + year + " failed:", e.message);
}
// Near year end, also look at next year so the footer and the grid's trailing days still work.
if (month === 12 || !holidays.some((h) => h.date >= today)) {
  try {
    holidays = holidays.concat(forState(await get("https://date.nager.at/api/v3/PublicHolidays/" + (year + 1) + "/AU", { cache: 86400 })));
    ok = true;
  } catch (e) {
    console.log("PublicHolidays " + (year + 1) + " failed:", e.message);
  }
}
const isHoliday = {};
for (const h of holidays) isHoliday[h.date] = h;

// ---- Header
export const title = MONTHS_LONG[month - 1] + " " + year;
export const header_right = STATE_LABEL + "  " + DAYS[new Date(ymd(today)).getUTCDay()] + " " + day;

// ---- Grid: 6 weeks x 7 days, Monday first. Days outside this month are dimmed.
const COL_W = 44, GRID_X = 6, GRID_Y = 38, ROW_H = 28;
const first = Date.UTC(year, month - 1, 1);
const lead = (new Date(first).getUTCDay() + 6) % 7; // days before the 1st in the first week
const start = first - lead * 86400000;
const weeksUsed = Math.ceil((lead + new Date(Date.UTC(year, month, 0)).getUTCDate()) / 7);
const D = [], C = [];
export let today_x = -200, today_y = -200;
for (let i = 0; i < 42; i++) {
  const d = new Date(start + i * 86400000);
  const k = key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  const inMonth = d.getUTCMonth() === month - 1;
  const weekend = i % 7 >= 5;
  const row = Math.floor(i / 7);
  let colour = inMonth ? (weekend ? "#9AA4B0" : "#FFFFFF") : "#3A4048";
  if (isHoliday[k]) colour = inMonth ? "#FF4040" : "#702020";
  if (k === today) {
    colour = "#000000";
    today_x = GRID_X + (i % 7) * COL_W + 3;
    today_y = GRID_Y + row * ROW_H + 1;
  }
  // Hide a sixth row that belongs entirely to next month.
  D.push(row < weeksUsed ? String(d.getUTCDate()) : "");
  C.push(colour);
}
// One text and one colour var per cell: d1/c1 is the top-left Monday, d42/c42 the bottom-right Sunday.
`;

const cellExports = Array.from({ length: 42 }, (_, i) => `export const d${i + 1} = D[${i}], c${i + 1} = C[${i}];`).join("\n");

const footerCode = String.raw`
// ---- Footer: next holiday this month, else the next one after it.
const upcoming = holidays
  .filter((h) => h.date >= today)
  .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
const next = upcoming[0];
const clean = (s) =>
  String(s || "Holiday")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/^Friday before (the )?AFL Grand Final/i, "AFL Grand Final Friday")
    .replace(/\s*\(Tentative Date\)/i, " (TBC)")
    .trim();
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const width = (s) => {
  let n = 0;
  for (const c of s) n += W2[c.charCodeAt(0) - 32] || 8;
  return n;
};
const fit = (s, max) => {
  if (width(s) <= max) return s;
  while (s.length > 1 && width(s + "...") > max) s = s.slice(0, -1);
  return s.trimEnd() + "...";
};
let label = "", when = "", name = "";
if (next) {
  const days = Math.round((ymd(next.date) - ymd(today)) / 86400000);
  label = days === 0 ? "TODAY" : Number(next.date.slice(5, 7)) === month && Number(next.date.slice(0, 4)) === year ? "THIS MONTH" : "NEXT";
  when = DAYS[new Date(ymd(next.date)).getUTCDay()] + " " + Number(next.date.slice(8, 10)) + " " + MONTHS[Number(next.date.slice(5, 7)) - 1] + (days > 0 ? "  " + days + "d" : "");
  name = fit(clean(next.localName || next.name), 312 - (26 + label.length * 6) - width(when) - 8);
} else {
  name = ok ? "No more holidays listed" : "Holidays unavailable";
}
export const foot_label = label;
export const foot_name = name;
export const foot_name_x = label ? 26 + label.length * 6 : 20; // just right of the label
export const foot_when = when;
`;

const GRID_X = 6, GRID_Y = 38, COL_W = 44, ROW_H = 28;
const ACCENT = "#FFB020";
const wire: RawWireOp[] = [
  ["fillScreen", "#0B0F14"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A2330"],
  ["text", "{title}", 8, 13, 2, 1, "ML", ACCENT],
  ["text", "{header_right}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Weekday labels
  ...["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(
    (d, i): RawWireOp => ["text", d, GRID_X + i * COL_W + COL_W / 2, 32, 1, 1, "MC", i >= 5 ? "#9AA4B0" : "#707A86"],
  ),
  // Today's box
  ["fillRoundRect", "{today_x}", "{today_y}", COL_W - 6, ROW_H - 2, 5, ACCENT],
  // Day numbers
  ...Array.from({ length: 42 }, (_, i): RawWireOp => [
    "text",
    `{d${i + 1}}`,
    GRID_X + (i % 7) * COL_W + COL_W / 2,
    GRID_Y + Math.floor(i / 7) * ROW_H + ROW_H / 2 + 1,
    4,
    1,
    "MC",
    `{c${i + 1}}`,
  ]),
  // Footer: next holiday
  ["drawFastHLine", 6, 209, 308, "#2A3442"],
  ["fillCircle", 11, 225, 3, "#FF4040"],
  ["text", "{foot_label}", 18, 225, 1, 1, "ML", "#9AA4B0"],
  ["text", "{foot_name}", "{foot_name_x}", 225, 2, 1, "ML", "#FFFFFF"],
  ["text", "{foot_when}", 312, 225, 2, 1, "MR", ACCENT],
];

const template: Template = {
  id: "month-calendar",
  name: "Month calendar",
  description: "This month as a Monday-first grid with today highlighted and Victorian public holidays in red.",
  apis: ["Nager.Date"],
  category: "clocks",
  dataCode: code + cellExports + "\n" + footerCode,
  rows: rows("month-calendar", wire),
  sampleVars: {"c1":"#3A4048","c10":"#FFFFFF","c11":"#FFFFFF","c12":"#FFFFFF","c13":"#9AA4B0","c14":"#9AA4B0","c15":"#FFFFFF","c16":"#FFFFFF","c17":"#FFFFFF","c18":"#FFFFFF","c19":"#FFFFFF","c2":"#3A4048","c20":"#9AA4B0","c21":"#9AA4B0","c22":"#FFFFFF","c23":"#FFFFFF","c24":"#FFFFFF","c25":"#FFFFFF","c26":"#FFFFFF","c27":"#000000","c28":"#9AA4B0","c29":"#FFFFFF","c3":"#3A4048","c30":"#FFFFFF","c31":"#FFFFFF","c32":"#FFFFFF","c33":"#FFFFFF","c34":"#9AA4B0","c35":"#9AA4B0","c36":"#FFFFFF","c37":"#3A4048","c38":"#3A4048","c39":"#3A4048","c4":"#3A4048","c40":"#3A4048","c41":"#3A4048","c42":"#3A4048","c5":"#3A4048","c6":"#3A4048","c7":"#9AA4B0","c8":"#FFFFFF","c9":"#FF4040","d1":"26","d10":"4","d11":"5","d12":"6","d13":"7","d14":"8","d15":"9","d16":"10","d17":"11","d18":"12","d19":"13","d2":"27","d20":"14","d21":"15","d22":"16","d23":"17","d24":"18","d25":"19","d26":"20","d27":"21","d28":"22","d29":"23","d3":"28","d30":"24","d31":"25","d32":"26","d33":"27","d34":"28","d35":"29","d36":"30","d37":"1","d38":"2","d39":"3","d4":"29","d40":"4","d41":"5","d42":"6","d5":"30","d6":"31","d7":"1","d8":"2","d9":"3","foot_label":"NEXT","foot_name":"Christmas Day","foot_name_x":50,"foot_when":"Fri 25 Dec  34d","header_right":"VIC  Sat 21","title":"NOVEMBER 2026","today_x":229,"today_y":123},
};

export default template;
