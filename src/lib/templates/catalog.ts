// Ready-made Services shown on /templates. Each template is a Data section (JS run by
// src/lib/data/run.ts) plus Draw rows (src/lib/draw/ops.ts), authored in the Draw JSON
// editor's wire form so they read like what a user would paste. `sampleVars` are real
// outputs of `dataCode` (captured from the live APIs) and drive the gallery preview.
//
// Draw has no conditions, so icons and arrows are switched by variables: a shape that should
// not show gets a y coordinate off screen (-200) from the Data section. (Painting it in the
// background colour would wipe shapes it overlaps.)

import type { DrawRow } from "@/lib/draw/ops";
import { wireToRows, type RawWireOp } from "@/lib/draw/wire";

export type TemplateVars = Record<string, string | number | boolean>;

export interface Template {
  id: string;
  name: string;
  description: string;
  apis: string[];
  dataCode: string;
  rows: DrawRow[];
  sampleVars: TemplateVars;
}

// Wire ops → rows with stable ids (`<template>-<index>`), so server and client render agree.
function rows(id: string, wire: RawWireOp[]): DrawRow[] {
  const res = wireToRows(wire);
  if (!res.ok) throw new Error(`Template "${id}": ${res.error}`);
  return res.rows.map((r, i) => ({ ...r, id: `${id}-${i}` }));
}

// ---------------------------------------------------------------------------------------------
// 1. Melbourne Metro departures + weather (port of Metro_Train_Schedule.ino)

const metroCode = String.raw`// Melbourne Metro departures + local weather.
// Ported from the Metro_Train_Schedule.ino ESP32 sketch.
// Change STOP_ID / PLATFORM to your station (PTV stop id) and LAT / LON for the weather.
const STOP_ID = "G1005"; // Altona
const PLATFORM = "P1";
const LAT = -37.8676;
const LON = 144.83;

const FOOTER = "#000080"; // footer bar colour (the icon draws on it)
const HIDE = -200; // y for icon parts that should not show

const ptvUrl = "https://esp32-ptv-display-um8x.vercel.app/departures?stop_id=" + STOP_ID +
  "&platform=" + PLATFORM + "&limit=4";
const wxUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
  "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
  "&wind_speed_unit=kmh&timezone=Australia%2FMelbourne";

const [ptv, wx] = await Promise.all([
  get(ptvUrl, { cache: 30 }),
  get(wxUrl, { cache: 600 }).catch((e) => {
    console.log("weather failed:", e.message);
    return null;
  }),
]);

// ---- Header
const stop = ptv.stop || {};
export const station = String(stop.name || "Unknown").toUpperCase().slice(0, 13);
export const platform = String(stop.platform || "?");
export const platform_x = 8 + station.length * 12 + 10; // after the name (font 1 size 2 = 12 px/char)
export const clock = now("HH:mm");

// ---- Departures (up to 4 rows)
const deps = Array.isArray(ptv.departures) ? ptv.departures.slice(0, 4) : [];
function row(i) {
  const d = deps[i];
  if (!d) return { dest: "", time: "", min: "", minCol: "#000000", late: "", sep: "#000000" };
  const remain = typeof d.remain === "number" ? d.remain : -1;
  const lateMin = Math.round((d.delay || 0) / 60);
  return {
    dest: String(d.dest || "Unknown").slice(0, 15),
    time: String(d.time || "--:--"),
    min: remain < 0 ? "" : remain === 0 ? "NOW" : String(remain),
    minCol: remain <= 1 ? "#FFA500" : "#00FF00",
    late: lateMin > 0 ? "+" + lateMin + "m" : "",
    sep: "#808080",
  };
}
const r1 = row(0), r2 = row(1), r3 = row(2), r4 = row(3);
export const dest1 = r1.dest, time1 = r1.time, min1 = r1.min, min_col1 = r1.minCol, late1 = r1.late;
export const dest2 = r2.dest, time2 = r2.time, min2 = r2.min, min_col2 = r2.minCol, late2 = r2.late;
export const dest3 = r3.dest, time3 = r3.time, min3 = r3.min, min_col3 = r3.minCol, late3 = r3.late;
export const dest4 = r4.dest, time4 = r4.time, min4 = r4.min, min_col4 = r4.minCol, late4 = r4.late;
export const sep2 = r2.sep, sep3 = r3.sep, sep4 = r4.sep;
export const none = deps.length ? "" : "NO DEPARTURES";

// ---- Weather footer
const cur = wx && wx.current;
const code = cur ? cur.weather_code : -1;
function describe(c) {
  if (c === 0) return "CLEAR";
  if (c === 1 || c === 2) return "PARTLY CLOUDY";
  if (c === 3) return "CLOUDY";
  if (c === 45 || c === 48) return "FOG";
  if (c >= 51 && c <= 57) return "DRIZZLE";
  if (c >= 61 && c <= 67) return "RAIN";
  if (c >= 71 && c <= 77) return "SNOW";
  if (c >= 80 && c <= 82) return "SHOWERS";
  if (c >= 95) return "STORM";
  return "";
}
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const weather = cur
  ? Math.round(cur.temperature_2m) + "C  " + describe(code) + "  " + cur.relative_humidity_2m + "% RH"
  : "WEATHER UNAVAILABLE";
export const wind = cur ? Math.round(cur.wind_speed_10m) + " km/h " + DIRS[Math.round(cur.wind_direction_10m / 45) % 8] : "";

// Icon: sun, small sun + cloud, cloud, or cloud + drops (rain cyan, snow white, storm yellow).
const sunny = code === 0;
const part = code === 1 || code === 2;
const cloudy = code > 0;
const drops = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
export const ic_sun_y = cur && sunny ? 230 : HIDE;
export const ic_psun_y = cur && part ? 226 : HIDE;
export const ic_cloud_y = cur && cloudy ? (drops ? 228 : 230) : HIDE;
export const ic_cloud = code === 45 || code === 48 ? "#D3D3D3" : "#FFFFFF";
export const ic_drop_y = cur && drops ? 235 : HIDE;
export const ic_drop = code >= 95 ? "#FFFF00" : code >= 71 && code <= 86 && !(code >= 80 && code <= 82) ? "#FFFFFF" : "#00FFFF";
`;

const metroWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header: station, platform, clock
  ["fillRect", 0, 0, 320, 32, "#000080"],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 2],
  ["setTextDatum", "TL"],
  ["drawString", "{station}", 8, 9, 1],
  ["setTextSize", 1],
  ["setTextColor", "#D3D3D3"],
  ["drawString", "PLATFORM {platform}", "{platform_x}", 13, 1],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 2],
  ["setTextDatum", "TR"],
  ["drawString", "{clock}", 312, 9, 1],
  // Column headers
  ["setTextSize", 1],
  ["setTextColor", "#D3D3D3"],
  ["setTextDatum", "TL"],
  ["drawString", "DESTINATION", 8, 40, 1],
  ["drawString", "TIME", 200, 40, 1],
  ["setTextDatum", "TR"],
  ["drawString", "MIN", 312, 40, 1],
  ["drawFastHLine", 0, 52, 320, "#808080"],
  // Row separators
  ["drawFastHLine", 5, 94, 310, "{sep2}"],
  ["drawFastHLine", 5, 133, 310, "{sep3}"],
  ["drawFastHLine", 5, 172, 310, "{sep4}"],
  // Departures: destination, time, minutes, delay
  ...[1, 2, 3, 4].flatMap((n): RawWireOp[] => {
    const y = 60 + (n - 1) * 39;
    return [
      ["setTextSize", 2],
      ["setTextDatum", "TL"],
      ["setTextColor", "#FFFFFF"],
      ["drawString", `{dest${n}}`, 8, y, 1],
      ["setTextColor", "#FFFF00"],
      ["drawString", `{time${n}}`, 200, y, 1],
      ["setTextDatum", "TR"],
      ["setTextColor", `{min_col${n}}`],
      ["drawString", `{min${n}}`, 312, y, 1],
      ["setTextSize", 1],
      ["setTextColor", "#FF0000"],
      ["drawString", `{late${n}}`, 312, y + 19, 1],
    ];
  }),
  ["setTextSize", 2],
  ["setTextDatum", "MC"],
  ["setTextColor", "#FF0000"],
  ["drawString", "{none}", 160, 130, 1],
  // Weather footer
  ["fillRect", 0, 220, 320, 20, "#000080"],
  ["fillCircle", 14, "{ic_sun_y}", 6, "#FFFF00"],
  ["fillCircle", 11, "{ic_psun_y}", 4, "#FFFF00"],
  ["fillCircle", 14, "{ic_cloud_y}", 4, "{ic_cloud}"],
  ["fillCircle", 20, "{ic_cloud_y}", 5, "{ic_cloud}"],
  ["fillRect", 10, "{ic_cloud_y}", 16, 5, "{ic_cloud}"],
  ["fillRect", 12, "{ic_drop_y}", 2, 4, "{ic_drop}"],
  ["fillRect", 17, "{ic_drop_y}", 2, 4, "{ic_drop}"],
  ["fillRect", 22, "{ic_drop_y}", 2, 4, "{ic_drop}"],
  ["setTextSize", 1],
  ["setTextColor", "#FFFFFF"],
  ["setTextDatum", "ML"],
  ["drawString", "{weather}", 32, 230, 1],
  ["setTextDatum", "MR"],
  ["drawString", "{wind}", 312, 230, 1],
];

// ---------------------------------------------------------------------------------------------
// 2. Weather

const weatherCode = String.raw`// Current weather and today's range from Open-Meteo (free, no key).
// Set PLACE, LAT and LON to your location.
const PLACE = "MELBOURNE";
const LAT = -37.8136;
const LON = 144.9631;
const HIDE = -200; // y for icon parts that should not show

const wx = await get(
  "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1" +
    "&wind_speed_unit=kmh&timezone=Australia%2FMelbourne",
  { cache: 600 },
);
const c = wx.current;
const d = wx.daily;
const code = c.weather_code;

function describe(n) {
  if (n === 0) return "Clear";
  if (n === 1) return "Mostly clear";
  if (n === 2) return "Partly cloudy";
  if (n === 3) return "Overcast";
  if (n === 45 || n === 48) return "Fog";
  if (n >= 51 && n <= 57) return "Drizzle";
  if (n >= 61 && n <= 67) return "Rain";
  if (n >= 71 && n <= 77) return "Snow";
  if (n >= 80 && n <= 82) return "Showers";
  if (n === 85 || n === 86) return "Snow showers";
  if (n >= 95) return "Thunderstorm";
  return "";
}
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export const place = PLACE;
export const clock = now("ddd HH:mm");

const t = Math.round(c.temperature_2m);
export const temp = String(t);
export const temp_col = t < 10 ? "#80B4FF" : t < 20 ? "#FFFFFF" : t < 28 ? "#FFC040" : "#FF6040";
export const cond = describe(code);
export const feels = "Feels like " + Math.round(c.apparent_temperature);

export const low = String(Math.round(d.temperature_2m_min[0]));
export const high = String(Math.round(d.temperature_2m_max[0]));
export const rain = (d.precipitation_probability_max[0] ?? 0) + "%";
export const wind = String(Math.round(c.wind_speed_10m));
export const wind_unit = "km/h " + DIRS[Math.round(c.wind_direction_10m / 45) % 8];

// Icon: sun, sun behind cloud, cloud, or cloud with drops (rain cyan, snow white, storm yellow).
const drops = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
export const ic_sun_y = code === 0 ? 92 : HIDE;
export const ic_psun_y = code === 1 || code === 2 ? 78 : HIDE;
export const ic_cloud_y = code > 0 ? (drops ? 92 : 100) : HIDE;
export const ic_cloud = code === 45 || code === 48 || drops ? "#D3D3D3" : "#FFFFFF";
export const ic_drop_y = drops ? 124 : HIDE;
export const ic_drop = code >= 95 ? "#FFFF00" : code >= 71 && code <= 86 && !(code >= 80 && code <= 82) ? "#FFFFFF" : "#00C8FF";
`;

const CARD = "#18283C";
const weatherWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 28, "#003366"],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 1],
  ["setTextDatum", "ML"],
  ["drawString", "{place}", 8, 14, 2],
  ["setTextColor", "#C0D0E0"],
  ["setTextDatum", "MR"],
  ["drawString", "{clock}", 312, 14, 2],
  // Icon
  ["fillCircle", 64, "{ic_sun_y}", 28, "#FFC800"],
  ["fillCircle", 50, "{ic_psun_y}", 18, "#FFC800"],
  ["fillCircle", 56, "{ic_cloud_y}", 16, "{ic_cloud}"],
  ["fillCircle", 84, "{ic_cloud_y}", 22, "{ic_cloud}"],
  ["fillRoundRect", 30, "{ic_cloud_y}", 86, 26, 13, "{ic_cloud}"],
  ["fillRect", 46, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  ["fillRect", 66, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  ["fillRect", 86, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  ["fillRect", 106, "{ic_drop_y}", 3, 12, "{ic_drop}"],
  // Big temperature with a drawn degree ring
  ["setTextColor", "{temp_col}"],
  ["setTextDatum", "TR"],
  ["setTextSize", 2],
  ["drawString", "{temp}", 258, 44, 4],
  ["drawCircle", 266, 52, 5, "{temp_col}"],
  ["drawCircle", 266, 52, 4, "{temp_col}"],
  ["setTextSize", 1],
  ["setTextDatum", "TL"],
  ["drawString", "C", 275, 44, 4],
  ["setTextColor", "#FFFFFF"],
  ["setTextDatum", "TR"],
  ["drawString", "{cond}", 300, 104, 4],
  ["setTextColor", "#A0A0A0"],
  ["drawString", "{feels}", 300, 134, 2],
  // Cards: low, high, rain, wind
  ["fillRoundRect", 8, 166, 70, 66, 6, CARD],
  ["fillRoundRect", 86, 166, 70, 66, 6, CARD],
  ["fillRoundRect", 164, 166, 70, 66, 6, CARD],
  ["fillRoundRect", 242, 166, 70, 66, 6, CARD],
  ["setTextDatum", "TC"],
  ["setTextColor", "#A0B0C0"],
  ["drawString", "LOW", 43, 174, 1],
  ["drawString", "HIGH", 121, 174, 1],
  ["drawString", "RAIN", 199, 174, 1],
  ["drawString", "WIND", 277, 174, 1],
  ["setTextColor", "#80B4FF"],
  ["drawString", "{low}", 43, 186, 4],
  ["setTextColor", "#FFC040"],
  ["drawString", "{high}", 121, 186, 4],
  ["setTextColor", "#00C8FF"],
  ["drawString", "{rain}", 199, 186, 4],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "{wind}", 277, 186, 4],
  ["setTextColor", "#A0B0C0"],
  ["drawString", "C", 43, 216, 1],
  ["drawString", "C", 121, 216, 1],
  ["drawString", "chance", 199, 216, 1],
  ["drawString", "{wind_unit}", 277, 216, 1],
];

// ---------------------------------------------------------------------------------------------
// 3. Big clock + date

const clockCode = String.raw`// A big clock with the date, a greeting and how much of the day has gone.
// Uses only now() (in the service owner's timezone). The screen refreshes on each device poll.
const DAYS = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const h = Number(now("HH"));
const m = Number(now("mm"));

export const time = now("HH:mm");
export const weekday = DAYS[now("ddd")] || now("ddd");
export const date = Number(now("DD")) + " " + MONTHS[Number(now("MM")) - 1] + " " + now("YYYY");

// Colour and greeting follow the time of day.
const part = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 21 ? 2 : 3;
export const greeting = ["Good morning", "Good afternoon", "Good evening", "Good night"][part];
export const accent = ["#FFA500", "#00C8FF", "#FF6080", "#8C8CFF"][part];

// Progress bar: 240 px wide at 100%.
const pct = Math.floor(((h * 60 + m) / 1440) * 100);
export const day_pct = pct + "% OF TODAY DONE";
export const day_w = Math.max(8, Math.round((240 * pct) / 100));
`;

const clockWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 4, "{accent}"],
  ["setTextSize", 1],
  ["setTextDatum", "TC"],
  ["setTextColor", "#A0A0A0"],
  ["drawString", "{greeting}", 160, 18, 2],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 3],
  ["setTextDatum", "MC"],
  ["drawString", "{time}", 160, 96, 4],
  ["setTextSize", 1],
  ["setTextDatum", "TC"],
  ["setTextColor", "{accent}"],
  ["drawString", "{weekday}", 160, 146, 4],
  ["setTextColor", "#D3D3D3"],
  ["drawString", "{date}", 160, 178, 2],
  ["fillRoundRect", 40, 208, 240, 8, 4, "#303030"],
  ["fillRoundRect", 40, 208, "{day_w}", 8, 4, "{accent}"],
  ["setTextColor", "#808080"],
  ["drawString", "{day_pct}", 160, 224, 1],
];

// ---------------------------------------------------------------------------------------------
// 4. Crypto prices

const cryptoCode = String.raw`// Three coin prices with 24 h change from CoinGecko (free, no key; keep cache >= 60 s).
// Change COINS (CoinGecko ids) and CURRENCY to suit.
const CURRENCY = "aud";
const COINS = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin", letter: "B", col: "#F7931A" },
  { id: "ethereum", sym: "ETH", name: "Ethereum", letter: "E", col: "#627EEA" },
  { id: "solana", sym: "SOL", name: "Solana", letter: "S", col: "#9945FF" },
];
const ROW_Y = [34, 102, 170]; // top of each card in Draw

const prices = await get(
  "https://api.coingecko.com/api/v3/simple/price?ids=" + COINS.map((c) => c.id).join(",") +
    "&vs_currencies=" + CURRENCY + "&include_24hr_change=true",
  { cache: 120 },
);

function money(v) {
  if (typeof v !== "number") return "--";
  const [int, frac] = v.toFixed(v >= 1000 ? 0 : v >= 1 ? 2 : 4).split(".");
  return "$" + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "");
}

function coin(i) {
  const c = COINS[i];
  const p = prices[c.id] || {};
  const chg = p[CURRENCY + "_24h_change"];
  const up = typeof chg === "number" && chg >= 0;
  const y = ROW_Y[i];
  return {
    sym: c.sym, name: c.name, letter: c.letter, col: c.col,
    price: money(p[CURRENCY]),
    chg: typeof chg === "number" ? (up ? "+" : "") + chg.toFixed(2) + "%" : "",
    chgCol: up ? "#3ECF8E" : "#FF5A5F",
    // Arrow triangle: base and tip y (pointing up or down).
    base: typeof chg !== "number" ? -200 : up ? y + 53 : y + 44,
    tip: typeof chg !== "number" ? -200 : up ? y + 44 : y + 53,
  };
}
const a = coin(0), b = coin(1), c = coin(2);
export const c1_sym = a.sym, c1_name = a.name, c1_letter = a.letter, c1_col = a.col, c1_price = a.price, c1_chg = a.chg, c1_chg_col = a.chgCol, c1_base = a.base, c1_tip = a.tip;
export const c2_sym = b.sym, c2_name = b.name, c2_letter = b.letter, c2_col = b.col, c2_price = b.price, c2_chg = b.chg, c2_chg_col = b.chgCol, c2_base = b.base, c2_tip = b.tip;
export const c3_sym = c.sym, c3_name = c.name, c3_letter = c.letter, c3_col = c.col, c3_price = c.price, c3_chg = c.chg, c3_chg_col = c.chgCol, c3_base = c.base, c3_tip = c.tip;
export const currency = CURRENCY.toUpperCase();
export const clock = now("HH:mm");
`;

const cryptoWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#202020"],
  ["setTextSize", 1],
  ["setTextDatum", "ML"],
  ["setTextColor", "#FFA500"],
  ["drawString", "CRYPTO", 8, 14, 2],
  ["setTextDatum", "MR"],
  ["setTextColor", "#A0A0A0"],
  ["drawString", "{currency}  {clock}", 312, 14, 2],
  ...[1, 2, 3].flatMap((n): RawWireOp[] => {
    const y = [34, 102, 170][n - 1];
    return [
      ["fillRoundRect", 8, y, 304, 64, 8, "#181818"],
      ["fillCircle", 34, y + 32, 17, `{c${n}_col}`],
      ["setTextDatum", "MC"],
      ["setTextColor", "#FFFFFF"],
      ["drawString", `{c${n}_letter}`, 34, y + 33, 4],
      ["setTextDatum", "TL"],
      ["drawString", `{c${n}_sym}`, 62, y + 10, 4],
      ["setTextColor", "#A0A0A0"],
      ["drawString", `{c${n}_name}`, 63, y + 42, 1],
      ["setTextDatum", "TR"],
      ["setTextColor", "#FFFFFF"],
      ["drawString", `{c${n}_price}`, 302, y + 10, 4],
      ["setTextColor", `{c${n}_chg_col}`],
      ["drawString", `{c${n}_chg}`, 302, y + 40, 2],
      ["fillTriangle", 224, `{c${n}_base}`, 234, `{c${n}_base}`, 229, `{c${n}_tip}`, `{c${n}_chg_col}`],
    ];
  }),
];

// ---------------------------------------------------------------------------------------------
// 5. Quote of the day

const quoteCode = String.raw`// Quote of the day from ZenQuotes (free, no key, changes daily; attribution required).
// The quote is word-wrapped here because Draw has no wrapping.
const MAX_CHARS = 32; // per line, font 2 (about 8 px/char)
const MAX_LINES = 6;
const PITCH = 22; // px between lines

let q = "Stay hungry, stay foolish.";
let author = "Steve Jobs";
try {
  const res = await get("https://zenquotes.io/api/today", { cache: 3600 });
  if (Array.isArray(res) && res[0] && res[0].q) {
    q = res[0].q;
    author = res[0].a || "Unknown";
  }
} catch (e) {
  console.log("quote failed:", e.message);
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");

const words = ascii(q).split(/\s+/).filter(Boolean);
const lines = [];
let line = "";
for (const w of words) {
  if (line && (line + " " + w).length > MAX_CHARS) {
    lines.push(line);
    line = w;
  } else {
    line = line ? line + " " + w : w;
  }
}
if (line) lines.push(line);
if (lines.length > MAX_LINES) {
  lines.length = MAX_LINES;
  lines[MAX_LINES - 1] = lines[MAX_LINES - 1].slice(0, MAX_CHARS - 3) + "...";
}

// Centre the block (quote + author line) between the header (y 28) and the footer (y 222).
const top = Math.round(125 - ((lines.length + 1) * PITCH + 6) / 2);
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "";
export const l4 = lines[3] || "", l5 = lines[4] || "", l6 = lines[5] || "";
export const y1 = top, y2 = top + PITCH, y3 = top + 2 * PITCH, y4 = top + 3 * PITCH, y5 = top + 4 * PITCH, y6 = top + 5 * PITCH;
export const author_line = "- " + ascii(author);
export const author_y = top + lines.length * PITCH + 6;
export const date = now("ddd DD/MM");
`;

const quoteWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#3C1450"],
  ["setTextSize", 1],
  ["setTextDatum", "ML"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "QUOTE OF THE DAY", 8, 14, 2],
  ["setTextDatum", "MR"],
  ["setTextColor", "#D0B0E0"],
  ["drawString", "{date}", 312, 14, 2],
  ["fillRect", 8, 40, 3, 172, "#B060E0"],
  ["setTextDatum", "TC"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "{l1}", 164, "{y1}", 2],
  ["drawString", "{l2}", 164, "{y2}", 2],
  ["drawString", "{l3}", 164, "{y3}", 2],
  ["drawString", "{l4}", 164, "{y4}", 2],
  ["drawString", "{l5}", 164, "{y5}", 2],
  ["drawString", "{l6}", 164, "{y6}", 2],
  ["setTextColor", "#C080F0"],
  ["drawString", "{author_line}", 164, "{author_y}", 2],
  ["setTextColor", "#606060"],
  ["setTextDatum", "BC"],
  ["drawString", "Quotes by zenquotes.io", 160, 236, 1],
];

// ---------------------------------------------------------------------------------------------

export const TEMPLATES: Template[] = [
  {
    id: "metro-departures",
    name: "Metro departures + weather",
    description: "Next four trains from a Melbourne Metro platform, with live delays and a weather footer.",
    apis: ["PTV departures proxy", "Open-Meteo"],
    dataCode: metroCode,
    rows: rows("metro-departures", metroWire),
    sampleVars: {"clock": "22:50", "dest1": "Werribee", "dest2": "Sandringham", "dest3": "Werribee", "dest4": "Sandringham", "ic_cloud": "#FFFFFF", "ic_cloud_y": 230, "ic_drop": "#00FFFF", "ic_drop_y": -200, "ic_psun_y": 226, "ic_sun_y": -200, "late1": "+2m", "late2": "", "late3": "+3m", "late4": "", "min1": "1", "min2": "5", "min3": "22", "min4": "25", "min_col1": "#FFA500", "min_col2": "#00FF00", "min_col3": "#00FF00", "min_col4": "#00FF00", "none": "", "platform": "1", "platform_x": 90, "sep2": "#808080", "sep3": "#808080", "sep4": "#808080", "station": "ALTONA", "time1": "22:52", "time2": "22:56", "time3": "23:13", "time4": "23:16", "weather": "20C  PARTLY CLOUDY  64% RH", "wind": "14 km/h N"},
  },
  {
    id: "weather",
    name: "Weather",
    description: "Big current temperature with an icon, today's low and high, rain chance and wind.",
    apis: ["Open-Meteo"],
    dataCode: weatherCode,
    rows: rows("weather", weatherWire),
    sampleVars: {"clock": "Fri 22:50", "cond": "Partly cloudy", "feels": "Feels like 21", "high": "27", "ic_cloud": "#FFFFFF", "ic_cloud_y": 100, "ic_drop": "#00C8FF", "ic_drop_y": -200, "ic_psun_y": 78, "ic_sun_y": -200, "low": "20", "place": "MELBOURNE", "rain": "20%", "temp": "20", "temp_col": "#FFC040", "wind": "14", "wind_unit": "km/h N"},
  },
  {
    id: "clock",
    name: "Clock + date",
    description: "A large clock, the weekday and date, and a bar showing how much of the day has gone.",
    apis: ["now() only"],
    dataCode: clockCode,
    rows: rows("clock", clockWire),
    sampleVars: {"accent": "#FFA500", "date": "20 November 2026", "day_pct": "33% OF TODAY DONE", "day_w": 81, "greeting": "Good morning", "time": "08:05", "weekday": "Friday"},
  },
  {
    id: "crypto",
    name: "Crypto prices",
    description: "Bitcoin, Ethereum and Solana in AUD with 24-hour change, green up and red down.",
    apis: ["CoinGecko"],
    dataCode: cryptoCode,
    rows: rows("crypto", cryptoWire),
    sampleVars: {"c1_base": 78, "c1_chg": "-2.80%", "c1_chg_col": "#FF5A5F", "c1_col": "#F7931A", "c1_letter": "B", "c1_name": "Bitcoin", "c1_price": "$92,701", "c1_sym": "BTC", "c1_tip": 87, "c2_base": 146, "c2_chg": "-2.77%", "c2_chg_col": "#FF5A5F", "c2_col": "#627EEA", "c2_letter": "E", "c2_name": "Ethereum", "c2_price": "$2,622", "c2_sym": "ETH", "c2_tip": 155, "c3_base": 214, "c3_chg": "-3.46%", "c3_chg_col": "#FF5A5F", "c3_col": "#9945FF", "c3_letter": "S", "c3_name": "Solana", "c3_price": "$107.78", "c3_sym": "SOL", "c3_tip": 223, "clock": "22:50", "currency": "AUD"},
  },
  {
    id: "quote",
    name: "Quote of the day",
    description: "A new quote every day, word-wrapped and centred, with its author.",
    apis: ["ZenQuotes"],
    dataCode: quoteCode,
    rows: rows("quote", quoteWire),
    sampleVars: {"author_line": "- Celestine Chua", "author_y": 150, "date": "Fri 20/11", "l1": "Never waste a minute of your", "l2": "precious life thinking about", "l3": "people you don't like.", "l4": "", "l5": "", "l6": "", "y1": 78, "y2": 100, "y3": 122, "y4": 144, "y5": 166, "y6": 188},
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
