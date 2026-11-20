import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Countdown to an event: big days, then hours and minutes, and a progress bar since START

const code = String.raw`// Countdown to an event, using only now() (the service owner's timezone). No API.
// Change EVENT and TARGET together. TARGET is local wall-clock time in the owner's timezone,
// written "YYYY-MM-DDTHH:mm:ss", e.g. "2027-01-01T00:00:00". Leave TARGET empty to count
// down to the next New Year's Day automatically (it rolls over each year, so it never goes stale).
const EVENT = "New Year";
const TARGET = "";
// The progress bar runs from START to TARGET. Leave empty to start one year before TARGET.
const START = "";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => (n < 10 ? "0" : "") + n;
const ascii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "").trim();

// Everything is in "local wall-clock as if UTC" ms, so no timezone maths is needed.
const Y = Number(now("YYYY"));
const nowL = Date.parse(now("YYYY-MM-DD") + "T" + now("HH:mm:ss") + "Z");
function parseLocal(s) {
  const t = Date.parse(String(s).trim().replace(" ", "T") + (/T\d/.test(s) ? "" : "T00:00:00") + "Z");
  return isFinite(t) ? t : NaN;
}

let target = TARGET ? parseLocal(TARGET) : NaN;
let auto = false;
if (!isFinite(target)) {
  auto = true;
  // Celebrate all of New Year's Day, then count down to the next one.
  const isJan1 = now("MM") === "01" && now("DD") === "01";
  target = Date.UTC(isJan1 ? Y : Y + 1, 0, 1);
}
const td = new Date(target);
let start = START ? parseLocal(START) : NaN;
if (!isFinite(start) || start >= target) start = Date.UTC(td.getUTCFullYear() - 1, td.getUTCMonth(), td.getUTCDate(), td.getUTCHours(), td.getUTCMinutes());

let name = ascii(EVENT) || "Event";
if (auto && name === "New Year") name = "New Year " + td.getUTCFullYear();
if (name.length > 20) name = name.slice(0, 19) + ".";
export const event = name;

const left = target - nowL;
const done = left <= 0;
const mins = Math.max(0, Math.ceil(left / 60000)); // round up so 00:00 only shows at the end
const d = Math.floor(mins / 1440);
const h = Math.floor((mins % 1440) / 60);
const m = mins % 60;

export const clock = now("ddd DD/MM HH:mm");
export const days = done ? "" : String(d);
export const days_label = done ? "" : d === 1 ? "DAY" : "DAYS";
export const hours = done ? "" : pad2(h);
export const minutes = done ? "" : pad2(m);
export const on_date = done ? "" : DAYS[td.getUTCDay()] + " " + td.getUTCDate() + " " + MONTHS[td.getUTCMonth()];
export const on_time = done ? "" : pad2(td.getUTCHours()) + ":" + pad2(td.getUTCMinutes()) + " " + td.getUTCFullYear();
export const box_y = done ? -200 : 154;
export const lbl_hours = done ? "" : "HOURS";
export const lbl_minutes = done ? "" : "MINUTES";
export const lbl_on = done ? "" : "ON";

// Celebration state.
export const here = done ? "It's here!" : "";
export const here_sub = done ? (auto ? "Happy " + name + "!" : name + " - " + DAYS[td.getUTCDay()] + " " + td.getUTCDate() + " " + MONTHS[td.getUTCMonth()] + " " + td.getUTCFullYear()) : "";
const CONF = [[30, 60], [290, 64], [56, 150], [270, 150], [24, 112], [298, 118], [96, 186], [228, 186], [160, 196]];
export const c0y = done ? CONF[0][1] : -50;
export const c1y = done ? CONF[1][1] : -50;
export const c2y = done ? CONF[2][1] : -50;
export const c3y = done ? CONF[3][1] : -50;
export const c4y = done ? CONF[4][1] : -50;
export const c5y = done ? CONF[5][1] : -50;
export const c6y = done ? CONF[6][1] : -50;
export const c7y = done ? CONF[7][1] : -50;
export const c8y = done ? CONF[8][1] : -50;

// Progress from START to TARGET.
const p = done ? 1 : Math.min(1, Math.max(0, (nowL - start) / (target - start)));
export const bar_w = Math.round(304 * p);
export const bar_pct = (Math.floor(p * 1000) / 10).toFixed(1) + "%";
const sd = new Date(start);
export const bar_label = "since " + sd.getUTCDate() + " " + MONTHS[sd.getUTCMonth()] + " " + sd.getUTCFullYear();
export const bar_color = done ? "#60E060" : "#FFB020";
`;

const ACCENT = "#FFB020";
const LABEL = "#909090";
const BOX = "#1C1C28";
const BOX_EDGE = "#3A3A50";

function box(x: number, label: string, value: string, font: number, sub?: string): RawWireOp[] {
  const ops: RawWireOp[] = [
    ["fillRoundRect", x, "{box_y}", 96, 46, 6, BOX],
    ["drawRoundRect", x, "{box_y}", 96, 46, 6, BOX_EDGE],
    ["text", `{${label}}`, x + 48, 160, 1, 1, "TC", LABEL],
  ];
  if (sub) {
    ops.push(["text", `{${value}}`, x + 48, 172, font, 1, "TC", "#FFFFFF"]);
    ops.push(["text", `{${sub}}`, x + 48, 188, 1, 1, "TC", LABEL]);
  } else {
    ops.push(["text", `{${value}}`, x + 48, 184, font, 1, "MC", "#FFFFFF"]);
  }
  return ops;
}

const CONFETTI = [
  [30, "#FF5070"], [290, "#40C0FF"], [56, "#60E060"], [270, "#FFB020"], [24, "#C070FF"],
  [298, "#FF5070"], [96, "#FFB020"], [228, "#40C0FF"], [160, "#C070FF"],
] as const;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#1A1A2E"],
  ["text", "COUNTDOWN", 8, 14, 2, 1, "ML", ACCENT],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#D0D0D0"],
  ["text", "{event}", 160, 43, 4, 1, "MC", "#FFFFFF"],
  ["text", "{days}", 160, 95, 4, 3, "MC", ACCENT],
  ["text", "{days_label}", 160, 144, 2, 1, "MC", LABEL],
  ...box(8, "lbl_hours", "hours", 4),
  ...box(112, "lbl_minutes", "minutes", 4),
  ...box(216, "lbl_on", "on_date", 2, "on_time"),
  ...CONFETTI.map(([x, c], i): RawWireOp => ["fillCircle", x, `{c${i}y}`, 4, c]),
  ["text", "{here}", 160, 104, 4, 2, "MC", ACCENT],
  ["text", "{here_sub}", 160, 150, 2, 1, "MC", "#FFFFFF"],
  ["text", "{bar_label}", 8, 208, 1, 1, "TL", LABEL],
  ["text", "{bar_pct}", 312, 208, 1, 1, "TR", LABEL],
  ["fillRect", 8, 219, 304, 10, "#282828"],
  ["fillRect", 8, 219, "{bar_w}", 10, "{bar_color}"],
];

const template: Template = {
  id: "event-countdown",
  name: "Event countdown",
  description: "Counts down the days, hours and minutes to an event (next New Year by default), with a progress bar and an \"It's here!\" screen.",
  apis: ["now() only"],
  category: "clocks",
  dataCode: code,
  rows: rows("event-countdown", wire),
  sampleVars: {"bar_color":"#FFB020","bar_label":"since 1 Jan 2026","bar_pct":"88.7%","bar_w":270,"box_y":154,"c0y":-50,"c1y":-50,"c2y":-50,"c3y":-50,"c4y":-50,"c5y":-50,"c6y":-50,"c7y":-50,"c8y":-50,"clock":"Sat 21/11 01:11","days":"40","days_label":"DAYS","event":"New Year 2027","here":"","here_sub":"","hours":"22","lbl_hours":"HOURS","lbl_minutes":"MINUTES","lbl_on":"ON","minutes":"49","on_date":"Fri 1 Jan","on_time":"00:00 2027"},
};

export default template;
