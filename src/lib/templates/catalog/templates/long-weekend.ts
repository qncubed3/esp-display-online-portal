import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// The next long weekend in Victoria: day count in a big circle, its dates and holidays,
// a strip of the days off, and the leave day that would stretch it (Nager.Date, keyless)

const code = String.raw`// Next long weekend (3+ days off in a row) from Nager.Date public holidays (free, no key).
// Worked out from the state's own holidays rather than Nager's LongWeekend endpoint, which
// only counts national holidays (it misses King's Birthday, Melbourne Cup and the like).
// Change STATE to another region code (AU-NSW, AU-QLD, ...) to follow a different state.
const STATE = "AU-VIC";
const STATE_LABEL = "VIC";

const today = now("YYYY-MM-DD");
const year = Number(today.slice(0, 4));

// Holidays that apply to STATE, keyed by date.
const hol = {};
let ok = false;
for (const y of [year, year + 1]) {
  try {
    const list = await get("https://date.nager.at/api/v3/PublicHolidays/" + y + "/AU", { cache: 86400 });
    if (!Array.isArray(list)) continue;
    ok = true;
    for (const h of list) {
      if (!h || typeof h.date !== "string") continue;
      if (!(h.global || (Array.isArray(h.counties) && h.counties.includes(STATE)))) continue;
      const n = String(h.localName || h.name || "Holiday")
        .replace(/[‘’]/g, "'")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/^Friday before (the )?AFL Grand Final/i, "AFL Grand Final Friday")
        .replace(/\s*\(Tentative Date\)/i, "")
        .trim();
      (hol[h.date] = hol[h.date] || []).includes(n) || hol[h.date].push(n);
    }
  } catch (e) {
    console.log("PublicHolidays " + y + " failed:", e.message);
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;
const t0 = Date.UTC(year, Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const dow = (t) => new Date(t).getUTCDay();
const short = (t) => DAYS[dow(t)] + " " + new Date(t).getUTCDate() + " " + MONTHS[new Date(t).getUTCMonth()];

// Day i (from 6 days back to ~13 months ahead): off if a weekend or holiday.
const FROM = -6, TO = 400;
const off = (i) => { const t = t0 + i * DAY; return dow(t) === 0 || dow(t) === 6 || !!hol[iso(t)]; };
const hasHol = (a, b) => { for (let i = a; i <= b; i++) if (hol[iso(t0 + i * DAY)]) return true; return false; };

// Maximal runs of days off.
const runs = [];
for (let i = FROM; i <= TO; i++) {
  if (!off(i)) continue;
  const s = i;
  while (i + 1 <= TO && off(i + 1)) i++;
  runs.push({ s, e: i });
}
// Long weekends: runs of 3+ days with a holiday in them. A single work day between two runs
// is a bridge: taking it off joins them. Natural ones get a tip; a holiday on a Tue or Thu
// becomes a long weekend that needs the bridge day.
const lw = [];
for (let k = 0; k < runs.length; k++) {
  const r = runs[k];
  const len = r.e - r.s + 1;
  const prev = runs[k - 1], next = runs[k + 1];
  const joinPrev = prev && prev.e === r.s - 2 ? { s: prev.s, e: r.e, b: r.s - 1 } : null;
  const joinNext = next && next.s === r.e + 2 ? { s: r.s, e: next.e, b: r.e + 1 } : null;
  if (len >= 3 && hasHol(r.s, r.e)) {
    const j = [joinNext, joinPrev].filter((x) => x && x.e - x.s + 1 >= 4)[0];
    lw.push({ s: r.s, e: r.e, bridge: null, tip: j || null });
  } else if (joinNext && !(next.e - next.s + 1 >= 3 && hasHol(next.s, next.e)) && joinNext.e - joinNext.s + 1 >= 4 && hasHol(joinNext.s, joinNext.e)) {
    lw.push({ s: joinNext.s, e: joinNext.e, bridge: joinNext.b, tip: null });
  }
}
const upcoming = lw.filter((w) => w.e >= 0).sort((a, b) => a.s - b.s);
const w = upcoming[0];
const w2 = upcoming[1];

// Pixel widths of chars 32-126 in font 2 and font 4, to trim names to fit.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (s, tbl) => { let n = 0; for (const c of s) n += tbl[c.charCodeAt(0) - 32] || 8; return n; };
const fit = (s, tbl, max) => {
  if (width(s, tbl) <= max) return s;
  while (s.length > 1 && width(s + "...", tbl) > max) s = s.slice(0, -1);
  return s.trimEnd() + "...";
};

export const header_right = STATE_LABEL + "  " + short(t0);

// Holiday names in the weekend, in date order (Easter has four).
const names = [];
if (w) for (let i = w.s; i <= w.e; i++) for (const n of hol[iso(t0 + i * DAY)] || []) if (!names.includes(n)) names.push(n);
export const name1 = w ? fit(names[0] || "Long weekend", W4, 186) : "No data";
export const name2 = names.length === 2 ? fit("+ " + names[1], W2, 186) : names.length > 2 ? "+ " + (names.length - 1) + " more holidays" : "";

const count = w ? w.e - w.s + 1 : 0;
export const count_txt = w ? String(count) : "--";
export const count_lbl = "DAYS OFF";
export const status = !w ? (ok ? "None found" : "Holidays unavailable") : w.s <= 0 ? "ON NOW - enjoy!" : w.s === 1 ? "STARTS TOMORROW" : "STARTS IN " + w.s + " DAYS";
export const status_col = w && w.s <= 0 ? "#60E060" : "#FFB020";
export const range = w ? short(t0 + w.s * DAY) + " - " + short(t0 + w.e * DAY) : "Will retry shortly";
export const range_y = name2 ? 112 : 96;

// Strip of up to 6 days: holidays gold, weekends teal, the bridge day outlined orange.
const SLOTS = 6, BW = 46, GAP = 4;
const days = [];
if (w) for (let i = w.s; i <= w.e && days.length < SLOTS; i++) days.push(i);
const x0 = Math.round(160 - (days.length * BW + (days.length - 1) * GAP) / 2);
const strip = {};
for (let k = 0; k < SLOTS; k++) {
  const i = days[k];
  const show = i !== undefined;
  const t = t0 + (show ? i : 0) * DAY;
  const isH = show && !!hol[iso(t)];
  const isB = show && w.bridge === i;
  strip["b" + k + "_x"] = show ? x0 + k * (BW + GAP) : -100;
  strip["b" + k + "_cx"] = show ? x0 + k * (BW + GAP) + BW / 2 : -100;
  strip["b" + k + "_fill"] = isH ? "#FFCD00" : isB ? "#3A2A10" : "#123C44";
  strip["b" + k + "_edge"] = isB ? "#FF8A20" : isH ? "#FFCD00" : "#2A6A74";
  strip["b" + k + "_fg"] = isH ? "#1A1400" : "#FFFFFF";
  strip["b" + k + "_d"] = show ? DAYS[dow(t)] : "";
  strip["b" + k + "_n"] = show ? String(new Date(t).getUTCDate()) : "";
}
export const b0_x = strip.b0_x, b0_cx = strip.b0_cx, b0_fill = strip.b0_fill, b0_edge = strip.b0_edge, b0_fg = strip.b0_fg, b0_d = strip.b0_d, b0_n = strip.b0_n;
export const b1_x = strip.b1_x, b1_cx = strip.b1_cx, b1_fill = strip.b1_fill, b1_edge = strip.b1_edge, b1_fg = strip.b1_fg, b1_d = strip.b1_d, b1_n = strip.b1_n;
export const b2_x = strip.b2_x, b2_cx = strip.b2_cx, b2_fill = strip.b2_fill, b2_edge = strip.b2_edge, b2_fg = strip.b2_fg, b2_d = strip.b2_d, b2_n = strip.b2_n;
export const b3_x = strip.b3_x, b3_cx = strip.b3_cx, b3_fill = strip.b3_fill, b3_edge = strip.b3_edge, b3_fg = strip.b3_fg, b3_d = strip.b3_d, b3_n = strip.b3_n;
export const b4_x = strip.b4_x, b4_cx = strip.b4_cx, b4_fill = strip.b4_fill, b4_edge = strip.b4_edge, b4_fg = strip.b4_fg, b4_d = strip.b4_d, b4_n = strip.b4_n;
export const b5_x = strip.b5_x, b5_cx = strip.b5_cx, b5_fill = strip.b5_fill, b5_edge = strip.b5_edge, b5_fg = strip.b5_fg, b5_d = strip.b5_d, b5_n = strip.b5_n;

// Leave tip.
const dayName = (i) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow(t0 + i * DAY)];
export const tip = !w
  ? ""
  : w.bridge !== null
    ? "Take " + short(t0 + w.bridge * DAY) + " off for " + count + " days"
    : w.tip
      ? "Take " + short(t0 + w.tip.b * DAY) + " off to make it " + (w.tip.e - w.tip.s + 1)
      : "No leave needed - " + dayName(w.s) + " to " + dayName(w.e);
export const tip_col = w && (w.bridge !== null || w.tip) ? "#FF8A20" : "#A0A0A0";

export const then = w2 ? fit("Then: " + short(t0 + w2.s * DAY) + " - " + short(t0 + w2.e * DAY) + " (" + (w2.e - w2.s + 1) + " days)", W2, 304) : "";
`;

const ACCENT = "#FFB020";
const LABEL = "#A0A0A0";

const slot = (k: number): RawWireOp[] => [
  ["fillRoundRect", `{b${k}_x}`, 148, 46, 40, 5, `{b${k}_fill}`],
  ["drawRoundRect", `{b${k}_x}`, 148, 46, 40, 5, `{b${k}_edge}`],
  ["text", `{b${k}_d}`, `{b${k}_cx}`, 153, 1, 1, "TC", `{b${k}_fg}`],
  ["text", `{b${k}_n}`, `{b${k}_cx}`, 164, 2, 1, "TC", `{b${k}_fg}`],
];

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A2A30"],
  ["text", "LONG WEEKEND", 8, 13, 2, 1, "ML", ACCENT],
  ["text", "{header_right}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Day count in a circle
  ["fillCircle", 60, 86, 46, "#123C44"],
  ["drawCircle", 60, 86, 46, ACCENT],
  ["drawCircle", 60, 86, 45, ACCENT],
  ["text", "{count_txt}", 60, 78, 4, 2, "MC", "#FFFFFF"],
  ["text", "{count_lbl}", 60, 114, 1, 1, "MC", LABEL],
  // Details
  ["text", "{status}", 120, 40, 2, 1, "TL", "{status_col}"],
  ["text", "{name1}", 120, 60, 4, 1, "TL", "#FFFFFF"],
  ["text", "{name2}", 120, 90, 2, 1, "TL", "#D0D0D0"],
  ["text", "{range}", 120, "{range_y}", 2, 1, "TL", ACCENT],
  ["drawFastHLine", 8, 140, 304, "#303030"],
  // Strip of days off
  ...[0, 1, 2, 3, 4, 5].flatMap(slot),
  // Leave tip and the one after
  ["text", "{tip}", 160, 198, 2, 1, "TC", "{tip_col}"],
  ["text", "{then}", 160, 220, 2, 1, "TC", LABEL],
];

const template: Template = {
  id: "long-weekend",
  name: "Next long weekend",
  description: "Days off in the next Victorian long weekend, its dates and holidays, and which leave day would stretch it.",
  apis: ["Nager.Date"],
  category: "clocks",
  dataCode: code,
  rows: rows("long-weekend", wire),
  sampleVars: {"b0_cx":85,"b0_d":"Fri","b0_edge":"#FFCD00","b0_fg":"#1A1400","b0_fill":"#FFCD00","b0_n":"25","b0_x":62,"b1_cx":135,"b1_d":"Sat","b1_edge":"#2A6A74","b1_fg":"#FFFFFF","b1_fill":"#123C44","b1_n":"26","b1_x":112,"b2_cx":185,"b2_d":"Sun","b2_edge":"#2A6A74","b2_fg":"#FFFFFF","b2_fill":"#123C44","b2_n":"27","b2_x":162,"b3_cx":235,"b3_d":"Mon","b3_edge":"#FFCD00","b3_fg":"#1A1400","b3_fill":"#FFCD00","b3_n":"28","b3_x":212,"b4_cx":-100,"b4_d":"","b4_edge":"#2A6A74","b4_fg":"#FFFFFF","b4_fill":"#123C44","b4_n":"","b4_x":-100,"b5_cx":-100,"b5_d":"","b5_edge":"#2A6A74","b5_fg":"#FFFFFF","b5_fill":"#123C44","b5_n":"","b5_x":-100,"count_lbl":"DAYS OFF","count_txt":"4","header_right":"VIC  Sat 21 Nov","name1":"Christmas Day","name2":"+ Boxing Day","range":"Fri 25 Dec - Mon 28 Dec","range_y":112,"status":"STARTS IN 34 DAYS","status_col":"#FFB020","then":"Then: Fri 1 Jan - Sun 3 Jan (3 days)","tip":"No leave needed - Friday to Monday","tip_col":"#A0A0A0"},
};

export default template;
