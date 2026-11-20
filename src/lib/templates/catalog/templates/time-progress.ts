import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Progress bars for today, this week, this month and this year

const code = String.raw`// How far through today, this week (Mon-Sun), this month and this year we are.
// Uses only now() (in the service owner's timezone), so there is no API. Leap years and
// month lengths come from the calendar; days are taken as 24 hours.
const BAR_W = 304; // full bar width in px at 100%
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const Y = Number(now("YYYY"));
const M = Number(now("MM"));
const D = Number(now("DD"));
const h = Number(now("HH"));
const mi = Number(now("mm"));
const s = Number(now("ss"));
const ddd = now("ddd");
const dow = DOW[ddd] !== undefined ? DOW[ddd] : 0;

const DAY = 86400;
const secOfDay = h * 3600 + mi * 60 + s;
const leap = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0;
const daysInYear = leap ? 366 : 365;
const daysInMonth = new Date(Date.UTC(Y, M, 0)).getUTCDate(); // day 0 of next month
const dayOfYear = Math.round((Date.UTC(Y, M - 1, D) - Date.UTC(Y, 0, 1)) / 86400000); // 0-based

const pDay = secOfDay / DAY;
const pWeek = (dow * DAY + secOfDay) / (7 * DAY);
const pMonth = ((D - 1) * DAY + secOfDay) / (daysInMonth * DAY);
const pYear = (dayOfYear * DAY + secOfDay) / (daysInYear * DAY);

// Round down so 100.0% only shows at the very end.
function pct(p) { return (Math.floor(Math.min(1, Math.max(0, p)) * 1000) / 10).toFixed(1) + "%"; }
function w(p) { return Math.round(BAR_W * Math.min(1, Math.max(0, p))); }
function pad(n) { return n < 10 ? "0" + n : "" + n; }

export const date = ddd + " " + D + " " + MONTHS[M - 1].slice(0, 3) + " " + Y;
export const time = now("HH:mm");

const leftM = Math.ceil((DAY - secOfDay) / 60); // minutes left, rounded up
export const day_label = "Today";
export const day_info = Math.floor(leftM / 60) + "h " + pad(leftM % 60) + "m left";
export const day_pct = pct(pDay);
export const day_w = w(pDay);

export const week_label = "This week";
export const week_info = "day " + (dow + 1) + " of 7";
export const week_pct = pct(pWeek);
export const week_w = w(pWeek);

export const month_label = MONTHS[M - 1];
export const month_info = "day " + D + " of " + daysInMonth;
export const month_pct = pct(pMonth);
export const month_w = w(pMonth);

export const year_label = String(Y);
export const year_info = "day " + (dayOfYear + 1) + " of " + daysInYear;
export const year_pct = pct(pYear);
export const year_w = w(pYear);

const left = daysInYear - dayOfYear - 1; // whole days after today
export const days_left = left === 0 ? "Last day of " + Y + "!" : left + (left === 1 ? " day" : " days") + " left in " + Y;
`;

const LABEL = "#FFFFFF";
const INFO = "#909090";
const TRACK = "#282828";

function bar(key: string, y: number, color: string): RawWireOp[] {
  return [
    ["text", `{${key}_label}`, 8, y, 2, 1, "TL", LABEL],
    ["text", `{${key}_info}`, 120, y + 5, 1, 1, "TL", INFO],
    ["text", `{${key}_pct}`, 312, y, 2, 1, "TR", color],
    ["fillRect", 8, y + 19, 304, 12, TRACK],
    ["fillRect", 8, y + 19, `{${key}_w}`, 12, color],
  ];
}

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 30, "#1A1A2E"],
  ["text", "{date}", 8, 15, 2, 1, "ML", "#D0D0D0"],
  ["text", "{time}", 312, 16, 4, 1, "MR", "#FFFFFF"],
  ...bar("day", 38, "#FFA500"),
  ...bar("week", 82, "#00C8FF"),
  ...bar("month", 126, "#60E060"),
  ...bar("year", 170, "#FF6080"),
  ["drawFastHLine", 8, 214, 304, "#303030"],
  ["text", "{days_left}", 160, 227, 2, 1, "MC", "#A0A0A0"],
];

const template: Template = {
  id: "time-progress",
  name: "Time progress",
  description: "Progress bars for today, this week, this month and this year, with the days left in the year.",
  apis: ["now() only"],
  category: "clocks",
  dataCode: code,
  rows: rows("time-progress", wire),
  sampleVars: {"date": "Fri 20 Nov 2026", "day_info": "14h 55m left", "day_label": "Today", "day_pct": "37.8%", "day_w": 115, "days_left": "41 days left in 2026", "month_info": "day 20 of 30", "month_label": "November", "month_pct": "64.5%", "month_w": 196, "time": "09:05", "week_info": "day 5 of 7", "week_label": "This week", "week_pct": "62.5%", "week_w": 190, "year_info": "day 324 of 365", "year_label": "2026", "year_pct": "88.5%", "year_w": 269},
};

export default template;
