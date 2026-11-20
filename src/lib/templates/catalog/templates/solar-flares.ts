import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Solar flare monitor: current GOES X-ray class on an A-B-C-M-X scale bar,
// the latest flare, and a 7-day count of C, M and X flares.

// Scale bar. Data and Draw both use these numbers.
const BAR_X = 10; // left edge (class A1.0, flux 1e-8 W/m2)
const SEG = 60; // width of one class (one decade of flux)
const BAR_Y = 116;
const BAR_H = 16;

const code = String.raw`// Solar X-ray flares from NOAA SWPC (GOES primary satellite, free, no key).
// The current long-wave X-ray class, the latest flare (peak class, time and how long ago)
// and the number of C, M and X flares in the last 7 days.
const BAR_X = ${BAR_X}, SEG = ${SEG}; // keep in step with Draw
const BASE = "https://services.swpc.noaa.gov/json/goes/primary/";

async function load(path, secs) {
  try {
    return await get(BASE + path, { cache: secs });
  } catch (e) {
    return null;
  }
}

const latest = await load("xray-flares-latest.json", 300);
const week = await load("xray-flares-7-day.json", 900);

const LETTERS = "ABCMX";
const COLS = ["#8088A0", "#4090FF", "#30D060", "#FFB020", "#FF4040"];

// "C9.6" -> { i: 2, v: 9.6, flux: 9.6e-6 }
function parse(cls) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(String(cls || ""));
  if (!m) return null;
  const i = LETTERS.indexOf(m[1]);
  const v = parseFloat(m[2]);
  return { i: i, v: v, flux: v * Math.pow(10, i - 8) };
}
const colOf = (p) => (p ? COLS[p.i] : "#808080");

// Radio blackout level from the NOAA R scale.
function rLevel(p) {
  if (!p) return "";
  const f = p.flux;
  return f >= 2e-3 ? "R5 Extreme" : f >= 1e-3 ? "R4 Severe" : f >= 1e-4 ? "R3 Strong" : f >= 5e-5 ? "R2 Moderate" : f >= 1e-5 ? "R1 Minor" : "";
}

const L = Array.isArray(latest) && latest.length ? latest[0] : null;
const cur = parse(L && L.current_class);

export const cur_class = cur ? LETTERS[cur.i] + cur.v.toFixed(1) : "--";
export const cur_col = colOf(cur);
const lvl = rLevel(cur);
export const cur_status = !cur ? "No data" : lvl ? lvl : cur.i >= 2 ? "Elevated" : "Quiet";
export const cur_sub = !cur ? "" : lvl ? "radio blackout" : "no radio blackout";

// Marker on the log scale bar, clamped to the bar.
const pos = cur ? (Math.log(cur.flux) / Math.LN10 + 8) * SEG : -1000;
export const mark_x = cur ? Math.round(BAR_X + Math.max(2, Math.min(5 * SEG - 2, pos))) : -200;
export const mark_l = mark_x - 6, mark_r = mark_x + 6;

// Owner's UTC offset in minutes, for local times.
const d = new Date();
let off = parseInt(now("HH"), 10) * 60 + parseInt(now("mm"), 10) - (d.getUTCHours() * 60 + d.getUTCMinutes());
if (off > 14 * 60) off -= 1440;
if (off < -12 * 60) off += 1440;

function localHM(tag) {
  const m = /T(\d\d):(\d\d)/.exec(String(tag || ""));
  if (!m) return "--:--";
  const mins = (((parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + off) % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60), mm = mins % 60;
  return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
}
function ago(tag) {
  const t = Date.parse(String(tag || ""));
  if (!isFinite(t)) return "";
  const mins = Math.max(0, Math.round((d.getTime() - t) / 60000));
  if (mins < 60) return mins + " min ago";
  const h = Math.floor(mins / 60);
  if (h < 48) return h + "h " + (mins % 60) + "m ago";
  return Math.floor(h / 24) + " days ago";
}

// Latest flare.
const pk = parse(L && L.max_class);
export const fl_class = pk ? L.max_class : "--";
export const fl_col = colOf(pk);
export const fl_ago = pk ? ago(L.max_time) : L ? "No recent flare" : "No data";
export const fl_times = pk
  ? localHM(L.begin_time) + " - " + (L.end_time ? localHM(L.end_time) : "now") + ", peak " + localHM(L.max_time)
  : "";

// 7-day counts (by peak class) and the week's biggest flare.
let nc = 0, nm = 0, nx = 0, big = null, bigCls = "";
const okWeek = Array.isArray(week);
if (okWeek) {
  for (const f of week) {
    const p = parse(f && f.max_class);
    if (!p) continue;
    if (p.i === 2) nc++;
    else if (p.i === 3) nm++;
    else if (p.i === 4) nx++;
    if (!big || p.flux > big.flux) { big = p; bigCls = f.max_class; }
  }
}
export const n_c = okWeek ? String(nc) : "--";
export const n_m = okWeek ? String(nm) : "--";
export const n_x = okWeek ? String(nx) : "--";
export const big_class = big ? bigCls : "--";
export const big_col = colOf(big);

export const clock = now("HH:mm");
`;

const BG = "#000000";
const HEAD = "#3A1A08";
const CARD = "#1E1A14";
const LABEL = "#B0A090";
const SEG_COLS = ["#40445A", "#1A4A90", "#186830", "#906010", "#902020"];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "SOLAR FLARES", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "GOES X-ray", 200, 13, 1, 1, "MC", "#D0A070"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#FFD0A0"],
  // Current class
  ["text", "X-RAY NOW", 10, 36, 1, 1, "TL", LABEL],
  ["text", "{cur_class}", 10, 48, 4, 2, "TL", "{cur_col}"],
  ["text", "{cur_status}", 310, 62, 4, 1, "MR", "{cur_col}"],
  ["text", "{cur_sub}", 310, 84, 1, 1, "MR", LABEL],
  // Scale bar A..X with a marker
  // (marker line first so the class letters stay readable on top of it)
  ...[0, 1, 2, 3, 4].map((i): RawWireOp => ["fillRect", BAR_X + i * SEG, BAR_Y, SEG - 1, BAR_H, SEG_COLS[i]]),
  ["drawFastVLine", "{mark_x}", BAR_Y, BAR_H, "#FFFFFF"],
  ["fillTriangle", "{mark_x}", BAR_Y - 1, "{mark_l}", BAR_Y - 10, "{mark_r}", BAR_Y - 10, "#FFFFFF"],
  ...[0, 1, 2, 3, 4].map((i): RawWireOp => ["text", "ABCMX"[i], BAR_X + i * SEG + SEG / 2, BAR_Y + BAR_H / 2 + 1, 2, 1, "MC", "#E0E0E0"]),
  // Latest flare card
  ["fillRoundRect", 8, 140, 304, 50, 6, CARD],
  ["text", "LATEST FLARE", 16, 146, 1, 1, "TL", LABEL],
  ["text", "{fl_class}", 16, 158, 4, 1, "TL", "{fl_col}"],
  ["text", "{fl_ago}", 304, 146, 2, 1, "TR", "#FFFFFF"],
  ["text", "{fl_times}", 304, 168, 2, 1, "TR", LABEL],
  // 7-day counts
  ["fillRoundRect", 8, 196, 304, 38, 6, CARD],
  ["text", "LAST 7 DAYS", 16, 202, 1, 1, "TL", LABEL],
  ["text", "biggest", 16, 214, 1, 1, "TL", LABEL],
  ["text", "{big_class}", 62, 210, 2, 1, "TL", "{big_col}"],
  ["text", "C", 140, 215, 2, 1, "MR", "#30D060"],
  ["text", "{n_c}", 145, 215, 4, 1, "ML", "#FFFFFF"],
  ["text", "M", 210, 215, 2, 1, "MR", "#FFB020"],
  ["text", "{n_m}", 215, 215, 4, 1, "ML", "#FFFFFF"],
  ["text", "X", 270, 215, 2, 1, "MR", "#FF4040"],
  ["text", "{n_x}", 275, 215, 4, 1, "ML", "#FFFFFF"],
];

const template: Template = {
  id: "solar-flares",
  name: "Solar flare monitor",
  description: "Current GOES X-ray class on an A-B-C-M-X scale with radio blackout level, the latest flare and how long ago, and 7-day C/M/X flare counts.",
  apis: ["NOAA SWPC"],
  category: "space",
  dataCode: code,
  rows: rows("solar-flares", wire),
  sampleVars: {"big_class":"M2.4","big_col":"#FFB020","clock":"01:17","cur_class":"B3.3","cur_col":"#4090FF","cur_status":"Quiet","cur_sub":"no radio blackout","fl_ago":"2h 47m ago","fl_class":"C9.6","fl_col":"#30D060","fl_times":"22:10 - 22:56, peak 22:30","mark_l":95,"mark_r":107,"mark_x":101,"n_c":"61","n_m":"4","n_x":"0"},
};

export default template;
