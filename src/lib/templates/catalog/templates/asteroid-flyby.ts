import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Asteroid close approaches

const ROWS = 4;
const ROW_Y0 = 140; // top of the first list row
const ROW_H = 22;

const code = String.raw`// Asteroids passing Earth within 10 lunar distances in the next 30 days,
// from the NASA/JPL SBDB Close Approach Data (CAD) API (free, no key).
// Top card: the closest pass in the window. List: the next 4 passes, closest highlighted.
const MAX_LD = 10; // only passes closer than this many lunar distances
const DAYS = 30; // how far ahead to look
const ROWS = ${ROWS}, ROW_Y0 = ${ROW_Y0}, ROW_H = ${ROW_H}; // keep in step with Draw
const HIDE = -200;
const AU_PER_LD = 0.00256955529; // 1 lunar distance in AU
const URL = "https://ssd-api.jpl.nasa.gov/cad.api?dist-max=" + MAX_LD + "LD&date-min=now&date-max=%2B" + DAYS + "&sort=date";
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let data = null;
try {
  data = await get(URL, { cache: 21600 });
} catch (e) {
  console.log("CAD failed:", e.message);
}

// Owner's UTC offset in minutes, so pass times show in local time.
const d = new Date();
let off = parseInt(now("HH"), 10) * 60 + parseInt(now("mm"), 10) - (d.getUTCHours() * 60 + d.getUTCMinutes());
if (off > 14 * 60) off -= 1440;
if (off < -12 * 60) off += 1440;

// Rows are positional arrays: map them through "fields".
const passes = [];
if (data && Array.isArray(data.fields) && Array.isArray(data.data)) {
  const f = {};
  data.fields.forEach((k, i) => (f[k] = i));
  for (const r of data.data) {
    const m = /^(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/.exec(String(r[f.cd]));
    const au = parseFloat(r[f.dist]);
    if (!m || !isFinite(au) || MON[m[2]] === undefined) continue;
    const t = Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5]);
    if (t < Date.now()) continue; // already passed today
    passes.push({
      des: String(r[f.des]).replace(/[^\x20-\x7e]/g, "").trim(),
      t,
      ld: au / AU_PER_LD,
      v: parseFloat(r[f.v_rel]),
      h: parseFloat(r[f.h]),
    });
  }
}

function local(t) {
  return new Date(t + off * 60000);
}
const p2 = (n) => (n < 10 ? "0" : "") + n;
function shortDate(t) {
  const x = local(t);
  return x.getUTCDate() + " " + MONTHS[x.getUTCMonth()] + " " + p2(x.getUTCHours()) + ":" + p2(x.getUTCMinutes());
}
function longDate(t) {
  return DAYNAMES[local(t).getUTCDay()] + " " + shortDate(t);
}
const fmtLd = (ld) => (ld < 10 ? ld.toFixed(2) : ld.toFixed(1));
const fmtV = (v) => (isFinite(v) ? v.toFixed(1) : "--");
// Rough size from absolute magnitude H, assuming a typical albedo of 0.14.
function size(h) {
  if (!isFinite(h)) return "";
  const m = 3552000 * Math.pow(10, -h / 5);
  return m >= 1000 ? "~" + (m / 1000).toFixed(1) + " km wide" : "~" + Math.round(m) + " m wide";
}
const ldCol = (ld) => (ld < 1 ? "#FF8A3D" : "#FFFFFF"); // closer than the Moon

let best = null;
for (const p of passes) if (!best || p.ld < best.ld) best = p;

export const clock = now("HH:mm");
export const hero_des = best ? best.des : data ? "None due" : "No data";
export const hero_ld = best ? fmtLd(best.ld) : "--";
export const hero_unit = best ? "LD" : "";
export const hero_ld_col = best ? ldCol(best.ld) : "#9AA3B2";
export const hero_when = best ? longDate(best.t) : data ? "No close passes in " + DAYS + " days" : "Close approach feed unavailable";
export const hero_info = best ? fmtV(best.v) + " km/s  " + size(best.h) : "";
export const hero_moon = best ? (best.ld < 1 ? "Inside the Moon's orbit" : (best.ld * 384).toFixed(0) + "k km away") : "";
export const total = passes.length ? passes.length + " in " + DAYS + " days" : "";

const list = passes.slice(0, ROWS);
const r = [];
for (let i = 0; i < ROWS; i++) {
  const p = list[i];
  if (!p) {
    r.push({ des: "", when: "", ld: "", v: "", col: "#FFFFFF", hy: HIDE });
    continue;
  }
  r.push({ des: p.des, when: shortDate(p.t), ld: fmtLd(p.ld), v: fmtV(p.v), col: ldCol(p.ld), hy: p === best ? ROW_Y0 + i * ROW_H - 3 : HIDE });
}
export const r1_des = r[0].des, r1_when = r[0].when, r1_ld = r[0].ld, r1_v = r[0].v, r1_col = r[0].col, r1_hy = r[0].hy;
export const r2_des = r[1].des, r2_when = r[1].when, r2_ld = r[1].ld, r2_v = r[1].v, r2_col = r[1].col, r2_hy = r[1].hy;
export const r3_des = r[2].des, r3_when = r[2].when, r3_ld = r[2].ld, r3_v = r[2].v, r3_col = r[2].col, r3_hy = r[2].hy;
export const r4_des = r[3].des, r4_when = r[3].when, r4_ld = r[3].ld, r4_v = r[3].v, r4_col = r[3].col, r4_hy = r[3].hy;
`;

const ACCENT = "#FFB000";
const MUTED = "#9AA3B2";

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A1F2E"],
  ["text", "ASTEROID FLYBYS", 8, 13, 2, 1, "ML", ACCENT],
  ["text", "{clock}", 312, 13, 2, 1, "MR", MUTED],
  // Closest pass card
  ["fillRoundRect", 6, 32, 308, 84, 8, "#141A2E"],
  ["text", "CLOSEST IN 30 DAYS", 14, 40, 1, 1, "TL", MUTED],
  ["text", "{total}", 306, 40, 1, 1, "TR", MUTED],
  ["text", "{hero_des}", 14, 52, 4, 1, "TL", "#FFFFFF"],
  ["text", "{hero_ld}", 270, 50, 4, 1, "TR", "{hero_ld_col}"],
  ["text", "{hero_unit}", 274, 60, 2, 1, "TL", "{hero_ld_col}"],
  ["text", "{hero_when}", 14, 81, 2, 1, "TL", ACCENT],
  ["text", "{hero_moon}", 306, 81, 2, 1, "TR", MUTED],
  ["text", "{hero_info}", 14, 98, 2, 1, "TL", "#D0D6E0"],
  // List header
  ["text", "OBJECT", 10, 126, 1, 1, "TL", MUTED],
  ["text", "PASS (LOCAL)", 92, 126, 1, 1, "TL", MUTED],
  ["text", "LD", 252, 126, 1, 1, "TR", MUTED],
  ["text", "KM/S", 310, 126, 1, 1, "TR", MUTED],
  ["drawFastHLine", 6, 136, 308, "#2A3145"],
  // Rows: a band behind the closest pass, then its columns
  ...Array.from({ length: ROWS }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = ROW_Y0 + i * ROW_H;
    return [
      ["fillRoundRect", 6, `{r${n}_hy}`, 308, ROW_H - 1, 4, "#3A2A10"],
      ["text", `{r${n}_des}`, 10, y, 2, 1, "TL", "#FFFFFF"],
      ["text", `{r${n}_when}`, 92, y, 2, 1, "TL", "#D0D6E0"],
      ["text", `{r${n}_ld}`, 252, y, 2, 1, "TR", `{r${n}_col}`],
      ["text", `{r${n}_v}`, 310, y, 2, 1, "TR", "#D0D6E0"],
    ];
  }).flat(),
  // Footer
  ["text", "1 LD = Earth-Moon distance. NASA/JPL CAD", 160, 233, 1, 1, "MC", "#6B7385"],
];

const template: Template = {
  id: "asteroid-flyby",
  name: "Asteroid close approaches",
  description: "The closest asteroid pass of the next 30 days and the next four flybys within 10 lunar distances, with date, distance and speed.",
  apis: ["NASA/JPL CAD"],
  category: "space",
  dataCode: code,
  rows: rows("asteroid-flyby", wire),
  sampleVars: {"clock":"01:13","hero_des":"2026 WA1","hero_info":"13.6 km/s  ~5 m wide","hero_ld":"1.23","hero_ld_col":"#FFFFFF","hero_moon":"474k km away","hero_unit":"LD","hero_when":"Sun 22 Nov 09:28","r1_col":"#FFFFFF","r1_des":"2026 VN11","r1_hy":-200,"r1_ld":"5.15","r1_v":"7.1","r1_when":"21 Nov 17:47","r2_col":"#FFFFFF","r2_des":"2026 WB1","r2_hy":-200,"r2_ld":"1.90","r2_v":"14.0","r2_when":"22 Nov 06:54","r3_col":"#FFFFFF","r3_des":"2026 VY15","r3_hy":-200,"r3_ld":"9.61","r3_v":"13.3","r3_when":"22 Nov 08:20","r4_col":"#FFFFFF","r4_des":"2026 WA1","r4_hy":203,"r4_ld":"1.23","r4_v":"13.6","r4_when":"22 Nov 09:28","total":"15 in 30 days"},
};

export default template;
