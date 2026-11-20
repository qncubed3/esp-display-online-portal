import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Public holidays happening around the world today, plus a 7-day strip of counts (Nager.Date, keyless)

const code = String.raw`// Which countries have a public holiday today, from Nager.Date (free, no key).
// "Today" is in your Service timezone. If nobody has one today, the next day that does is listed.
const MAX_ROWS = 6; // rows in the list
const INCLUDE_OBSERVANCES = true; // false = only days off ("Public"/"Bank")

const today = now("YYYY-MM-DD");

let list = [];
try {
  const res = await get("https://date.nager.at/api/v3/NextPublicHolidaysWorldwide", { cache: 21600 });
  if (Array.isArray(res)) list = res;
} catch (e) {
  console.log("NextPublicHolidaysWorldwide failed:", e.message);
}

// Fonts are ASCII only: strip accents, then anything else non-ASCII.
const clean = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// One entry per country + date + name.
const seen = {};
const hols = list.filter((h) => {
  if (!h || typeof h.date !== "string" || !h.countryCode) return false;
  const types = Array.isArray(h.types) ? h.types : [];
  if (!INCLUDE_OBSERVANCES && !types.some((t) => t === "Public" || t === "Bank")) return false;
  const k = h.date + "|" + h.countryCode + "|" + h.name;
  if (seen[k]) return false;
  seen[k] = true;
  return true;
});

const ymd = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (s) => DAYS[new Date(ymd(s)).getUTCDay()] + " " + Number(s.slice(8, 10)) + " " + MONTHS[Number(s.slice(5, 7)) - 1];

// Font 2 widths (chars 32-126), to trim names to fit.
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

// Which day to list: today, or the next day with holidays.
const onDay = (d) => hols.filter((h) => h.date === d);
let day = today;
let items = onDay(today);
if (!items.length) {
  const later = hols.filter((h) => h.date > today).map((h) => h.date).sort();
  if (later.length) {
    day = later[0];
    items = onDay(day);
  }
}
items.sort((a, b) => (a.countryCode < b.countryCode ? -1 : a.countryCode > b.countryCode ? 1 : 0));

export const header_right = label(today);
const countries = {};
for (const h of items) countries[h.countryCode] = true;
const nCountries = Object.keys(countries).length;
export const section =
  !list.length ? "NO DATA - WILL RETRY" : !items.length ? "NOTHING THIS WEEK" : day === today ? "TODAY" : "NOTHING TODAY - NEXT " + label(day).toUpperCase();
export const section_count = items.length ? nCountries + (nCountries === 1 ? " country" : " countries") : "";

// Rows: country-code chip + English name. If too many, the last row says "+N more".
const shown = items.length > MAX_ROWS ? items.slice(0, MAX_ROWS - 1) : items;
const NAME_MAX = 264; // px, x 48 to 312
for (let i = 0; i < MAX_ROWS; i++) {
  const h = shown[i];
  const n = i + 1;
  let c = "", name = "", y = -100;
  if (h) {
    c = String(h.countryCode).slice(0, 3);
    name = fit(clean(h.name || h.localName) || "Holiday", NAME_MAX);
    y = 54 + i * 20;
  } else if (i === shown.length && items.length > shown.length) {
    name = "+" + (items.length - shown.length) + " more";
  }
  globalThis["c" + n] = c;
  globalThis["n" + n] = name;
  globalThis["y" + n] = y;
}
export const c1 = globalThis.c1, n1 = globalThis.n1, y1 = globalThis.y1;
export const c2 = globalThis.c2, n2 = globalThis.n2, y2 = globalThis.y2;
export const c3 = globalThis.c3, n3 = globalThis.n3, y3 = globalThis.y3;
export const c4 = globalThis.c4, n4 = globalThis.n4, y4 = globalThis.y4;
export const c5 = globalThis.c5, n5 = globalThis.n5, y5 = globalThis.y5;
export const c6 = globalThis.c6, n6 = globalThis.n6, y6 = globalThis.y6;

// 7-day strip: holidays per day from today, as bars.
const BAR_MAX = 20; // px
const counts = [];
for (let i = 0; i < 7; i++) counts.push(onDay(iso(ymd(today) + i * 86400000)).length);
const peak = Math.max(1, ...counts);
const total = counts.reduce((a, b) => a + b, 0);
export const week_total = list.length ? total + (total === 1 ? " holiday" : " holidays") : "--";
const BASE = 222;
for (let i = 0; i < 7; i++) {
  const d = iso(ymd(today) + i * 86400000);
  const h = counts[i] ? Math.max(3, Math.round((counts[i] / peak) * BAR_MAX)) : 0;
  globalThis["dl" + i] = i === 0 ? "Today" : DAYS[new Date(ymd(d)).getUTCDay()];
  globalThis["bh" + i] = h;
  globalThis["by" + i] = h ? BASE - h : -100;
  globalThis["bn" + i] = list.length ? String(counts[i]) : "";
  globalThis["bny" + i] = BASE - h - 2;
}
export const dl0 = globalThis.dl0, bh0 = globalThis.bh0, by0 = globalThis.by0, bn0 = globalThis.bn0, bny0 = globalThis.bny0;
export const dl1 = globalThis.dl1, bh1 = globalThis.bh1, by1 = globalThis.by1, bn1 = globalThis.bn1, bny1 = globalThis.bny1;
export const dl2 = globalThis.dl2, bh2 = globalThis.bh2, by2 = globalThis.by2, bn2 = globalThis.bn2, bny2 = globalThis.bny2;
export const dl3 = globalThis.dl3, bh3 = globalThis.bh3, by3 = globalThis.by3, bn3 = globalThis.bn3, bny3 = globalThis.bny3;
export const dl4 = globalThis.dl4, bh4 = globalThis.bh4, by4 = globalThis.by4, bn4 = globalThis.bn4, bny4 = globalThis.bny4;
export const dl5 = globalThis.dl5, bh5 = globalThis.bh5, by5 = globalThis.by5, bn5 = globalThis.bn5, bny5 = globalThis.bny5;
export const dl6 = globalThis.dl6, bh6 = globalThis.bh6, by6 = globalThis.by6, bn6 = globalThis.bn6, bny6 = globalThis.bny6;
`;

const ACCENT = "#FFB000";
const HEAD = "#0B3A53";
const COL_W = 304 / 7; // day columns across x 8..312

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "HOLIDAYS WORLDWIDE", 8, 13, 2, 1, "ML", ACCENT],
  ["text", "{header_right}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Section label
  ["text", "{section}", 8, 32, 2, 1, "TL", "#A0A0A0"],
  ["text", "{section_count}", 312, 32, 2, 1, "TR", ACCENT],
  // Rows: chip with country code, then the name
  ...[1, 2, 3, 4, 5, 6].flatMap((n): RawWireOp[] => {
    const y = 54 + (n - 1) * 20;
    return [
      ["fillRoundRect", 8, `{y${n}}`, 32, 17, 3, ACCENT],
      ["text", `{c${n}}`, 24, y + 9, 2, 1, "MC", "#000000"],
      ["text", `{n${n}}`, 48, y + 9, 2, 1, "ML", "#FFFFFF"],
    ];
  }),
  // 7-day strip
  ["drawFastHLine", 8, 176, 304, "#2A5A73"],
  ["text", "NEXT 7 DAYS", 8, 181, 1, 1, "TL", "#808080"],
  ["text", "{week_total}", 312, 181, 1, 1, "TR", "#808080"],
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((i): RawWireOp[] => {
    const cx = Math.round(8 + COL_W * i + COL_W / 2);
    const colour = i === 0 ? ACCENT : "#3C8DB4";
    return [
      ["fillRect", cx - 12, `{by${i}}`, 24, `{bh${i}}`, colour],
      ["text", `{bn${i}}`, cx, `{bny${i}}`, 1, 1, "BC", "#FFFFFF"],
      ["text", `{dl${i}}`, cx, 226, 1, 1, "TC", i === 0 ? ACCENT : "#A0A0A0"],
    ];
  }),
];

const template: Template = {
  id: "holidays-worldwide",
  name: "Holidays around the world",
  description: "Which countries have a public holiday today, with a 7-day strip of holiday counts worldwide.",
  apis: ["Nager.Date"],
  category: "world",
  dataCode: code,
  rows: rows("holidays-worldwide", wire),
  sampleVars: {"bh0":11,"bh1":0,"bh2":20,"bh3":3,"bh4":11,"bh5":20,"bh6":0,"bn0":"4","bn1":"0","bn2":"7","bn3":"1","bn4":"4","bn5":"7","bn6":"0","bny0":209,"bny1":220,"bny2":200,"bny3":217,"bny4":209,"bny5":200,"bny6":220,"by0":211,"by1":-100,"by2":202,"by3":219,"by4":211,"by5":202,"by6":-100,"c1":"BA","c2":"LV","c3":"MD","c4":"SV","c5":"","c6":"","dl0":"Today","dl1":"Sun","dl2":"Mon","dl3":"Tue","dl4":"Wed","dl5":"Thu","dl6":"Fri","header_right":"Sat 21 Nov","n1":"Day of the establishment of the Genera...","n2":"Remembrance Day of the Tragedy of 21...","n3":"South Capital's Day Cahul","n4":"Day of the Queen of Peace","n5":"","n6":"","section":"TODAY","section_count":"4 countries","week_total":"23 holidays","y1":54,"y2":74,"y3":94,"y4":114,"y5":-100,"y6":-100},
};

export default template;
