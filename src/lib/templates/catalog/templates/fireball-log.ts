import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Fireball log: the latest bright meteors (bolides) seen by US government sensors

const MAP_X = 150; // world map: equirectangular, 160 x 80 px
const MAP_Y = 36;
const MAP_W = 160;
const MAP_H = 80;
const ROWS = 4; // earlier fireballs listed below the card
const ROW_Y0 = 140;
const ROW_H = 22;

const code = String.raw`// The latest fireballs (bright meteors that explode in the atmosphere), from the
// NASA/JPL Fireball Data API (free, no key). Top card: the newest one, with its impact
// energy in kilotons of TNT. Map: where the last 5 were seen. List: the 4 before it.
const MAP_X = ${MAP_X}, MAP_Y = ${MAP_Y}, MAP_W = ${MAP_W}, MAP_H = ${MAP_H}; // keep in step with Draw
const ROWS = ${ROWS};
const HIDE = -200;
const URL = "https://ssd-api.jpl.nasa.gov/fireball.api?limit=" + (ROWS + 1);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let data = null;
try {
  data = await get(URL, { cache: 21600 });
} catch (e) {
  console.log("Fireball API failed:", e.message);
}

// Owner's UTC offset in minutes, so times show in local time.
const d = new Date();
let off = parseInt(now("HH"), 10) * 60 + parseInt(now("mm"), 10) - (d.getUTCHours() * 60 + d.getUTCMinutes());
if (off > 14 * 60) off -= 1440;
if (off < -12 * 60) off += 1440;

// Rows are positional arrays: map them through "fields". Lat/lon/alt can be null.
const balls = [];
if (data && Array.isArray(data.fields) && Array.isArray(data.data)) {
  const f = {};
  data.fields.forEach((k, i) => (f[k] = i));
  for (const r of data.data) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(r[f.date]));
    if (!m) continue;
    const lat = parseFloat(r[f.lat]), lon = parseFloat(r[f.lon]);
    const hasPos = isFinite(lat) && isFinite(lon);
    balls.push({
      t: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]),
      kt: parseFloat(r[f["impact-e"]]),
      lat: hasPos ? (r[f["lat-dir"]] === "S" ? -lat : lat) : NaN,
      lon: hasPos ? (r[f["lon-dir"]] === "W" ? -lon : lon) : NaN,
      pos: hasPos ? lat.toFixed(1) + r[f["lat-dir"]] + " " + lon.toFixed(1) + r[f["lon-dir"]] : "Unknown",
      alt: parseFloat(r[f.alt]),
    });
  }
}

const p2 = (n) => (n < 10 ? "0" : "") + n;
const local = (t) => new Date(t + off * 60000);
const day = (t) => local(t).getUTCDate() + " " + MONTHS[local(t).getUTCMonth()];
const fullDate = (t) => day(t) + " " + local(t).getUTCFullYear();
const hhmm = (t) => p2(local(t).getUTCHours()) + ":" + p2(local(t).getUTCMinutes());
const fmtKt = (kt) => (!isFinite(kt) ? "--" : kt < 10 ? kt.toFixed(2) : kt.toFixed(1));
const fmtAlt = (a) => (isFinite(a) ? Math.round(a) + " km" : "--");
function ago(t) {
  const days = Math.floor((Date.now() - t) / 86400000);
  return days < 1 ? "today" : days === 1 ? "yesterday" : days + " days ago";
}
// Map position; dots grow with energy.
const mx = (b) => (isFinite(b.lon) ? Math.round(MAP_X + ((b.lon + 180) / 360) * (MAP_W - 1)) : HIDE);
const my = (b) => (isFinite(b.lat) ? Math.round(MAP_Y + ((90 - b.lat) / 180) * (MAP_H - 1)) : HIDE);
const rad = (b) => (isFinite(b.kt) ? Math.max(2, Math.min(5, Math.round(2.5 + Math.log10(b.kt * 10)))) : 2);

const top = balls[0];
export const clock = now("HH:mm");
export const hero_date = top ? fullDate(top.t) : "--";
export const hero_time = top ? hhmm(top.t) + "  " + ago(top.t) : data ? "No fireballs listed" : "Feed unavailable";
export const hero_kt = top ? fmtKt(top.kt) : "--";
export const hero_unit = top ? "kt of TNT" : "";
// Font 4 widths: digits 14 px, "." 7, "-" 8. The unit sits just right of the number.
export const hero_unit_x = 14 + [...hero_kt].reduce((n, ch) => n + (ch === "." ? 7 : ch === "-" ? 8 : 14), 0) + 5;
export const hero_pos = top ? top.pos : "";
export const hero_alt = top && isFinite(top.alt) ? fmtAlt(top.alt) + " up" : "";
export const d0_x = top ? mx(top) : HIDE, d0_y = top ? my(top) : HIDE, d0_r = top ? rad(top) + 1 : 2;

const r = [];
for (let i = 0; i < ROWS; i++) {
  const b = balls[i + 1];
  if (!b) {
    r.push({ date: "", kt: "", pos: "", alt: "", x: HIDE, y: HIDE, rr: 2, ly: HIDE });
    continue;
  }
  r.push({ date: day(b.t) + " " + hhmm(b.t), kt: fmtKt(b.kt), pos: b.pos, alt: fmtAlt(b.alt), x: mx(b), y: my(b), rr: rad(b), ly: 0 });
}
export const r1_date = r[0].date, r1_kt = r[0].kt, r1_pos = r[0].pos, r1_alt = r[0].alt, d1_x = r[0].x, d1_y = r[0].y, d1_r = r[0].rr;
export const r2_date = r[1].date, r2_kt = r[1].kt, r2_pos = r[1].pos, r2_alt = r[1].alt, d2_x = r[1].x, d2_y = r[1].y, d2_r = r[1].rr;
export const r3_date = r[2].date, r3_kt = r[2].kt, r3_pos = r[2].pos, r3_alt = r[2].alt, d3_x = r[2].x, d3_y = r[2].y, d3_r = r[2].rr;
export const r4_date = r[3].date, r4_kt = r[3].kt, r4_pos = r[3].pos, r4_alt = r[3].alt, d4_x = r[3].x, d4_y = r[3].y, d4_r = r[3].rr;
`;

const ACCENT = "#FF7A1A"; // the latest fireball
const OLDER = "#FFD34D"; // earlier fireballs
const MUTED = "#9AA3B2";
const CARD = "#141A2E";
const GRID = "#2A3350";

const gx = (lon: number) => Math.round(MAP_X + ((lon + 180) / 360) * (MAP_W - 1));
const gy = (lat: number) => Math.round(MAP_Y + ((90 - lat) / 180) * (MAP_H - 1));

// Coarse land mask, 32 x 16 cells of 5 x 5 px (11.25 deg each), north at the top, 180W on the left.
const LAND = [
  "...........####.................",
  ".....######.####...###########..",
  ".##########.##..################",
  "....########...##############...",
  "....#######....##############...",
  ".....####......#############....",
  "......###......##########.......",
  "........####...#####.....##.....",
  "........#####....###.....###....",
  ".........####....####.....###...",
  ".........###.....##.......####..",
  ".........##.................#..#",
  ".........#......................",
  "................................",
  "################################",
  "################################",
];
const CELL = MAP_W / LAND[0].length;
function landRuns(): RawWireOp[] {
  const out: RawWireOp[] = [];
  LAND.forEach((row, r) => {
    for (const m of row.matchAll(/#+/g)) {
      out.push(["fillRect", MAP_X + (m.index ?? 0) * CELL, MAP_Y + r * CELL, m[0].length * CELL, CELL, "#26473F"]);
    }
  });
  return out;
}

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A1F2E"],
  ["text", "FIREBALL LOG", 8, 13, 2, 1, "ML", ACCENT],
  ["text", "{clock}", 312, 13, 2, 1, "MR", MUTED],
  // Latest fireball card
  ["fillRoundRect", 6, 32, 308, 90, 8, CARD],
  ["text", "LATEST FIREBALL", 14, 40, 1, 1, "TL", MUTED],
  ["text", "{hero_date}", 14, 52, 2, 1, "TL", "#FFFFFF"],
  ["text", "{hero_time}", 14, 68, 1, 1, "TL", MUTED],
  ["text", "{hero_kt}", 14, 80, 4, 1, "TL", ACCENT],
  ["text", "{hero_unit}", "{hero_unit_x}", 94, 1, 1, "TL", ACCENT],
  ["text", "{hero_pos}", 14, 108, 1, 1, "TL", "#D0D6E0"],
  ["text", "{hero_alt}", 142, 108, 1, 1, "TR", MUTED],
  // World map: grid every 60 deg longitude and 45 deg latitude, rough land on top, brighter equator
  ["fillRect", MAP_X, MAP_Y, MAP_W, MAP_H, "#0B1020"],
  ...[-120, -60, 0, 60, 120].map((lon): RawWireOp => ["drawFastVLine", gx(lon), MAP_Y, MAP_H, GRID]),
  ...[45, -45].map((lat): RawWireOp => ["drawFastHLine", MAP_X, gy(lat), MAP_W, GRID]),
  ...landRuns(),
  ["drawFastHLine", MAP_X, gy(0), MAP_W, "#3F4A70"],
  ["drawRect", MAP_X, MAP_Y, MAP_W, MAP_H, "#3F4A70"],
  // Dots: older ones first, the latest on top with a ring
  ...[4, 3, 2, 1].map((n): RawWireOp => ["fillCircle", `{d${n}_x}`, `{d${n}_y}`, `{d${n}_r}`, OLDER]),
  ["drawCircle", "{d0_x}", "{d0_y}", "{d0_r}", "#FFFFFF"],
  ["fillCircle", "{d0_x}", "{d0_y}", "{d0_r}", ACCENT],
  // Earlier list
  ["text", "EARLIER (LOCAL)", 10, 128, 1, 1, "TL", MUTED],
  ["text", "KT", 150, 128, 1, 1, "TR", MUTED],
  ["text", "LAT / LON", 162, 128, 1, 1, "TL", MUTED],
  ["text", "ALT", 310, 128, 1, 1, "TR", MUTED],
  ["drawFastHLine", 6, 137, 308, "#2A3145"],
  ...Array.from({ length: ROWS }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = ROW_Y0 + i * ROW_H + 2;
    return [
      ["text", `{r${n}_date}`, 10, y, 2, 1, "TL", "#FFFFFF"],
      ["text", `{r${n}_kt}`, 150, y, 2, 1, "TR", OLDER],
      ["text", `{r${n}_pos}`, 162, y, 2, 1, "TL", "#D0D6E0"],
      ["text", `{r${n}_alt}`, 310, y, 2, 1, "TR", MUTED],
    ];
  }).flat(),
  // Footer
  ["text", "Impact energy in kilotons of TNT. NASA/JPL CNEOS", 160, 233, 1, 1, "MC", "#6B7385"],
];

const template: Template = {
  id: "fireball-log",
  name: "Fireball log",
  description: "The latest bright meteor seen exploding in the atmosphere, with its energy, a world map of the last five and a list of the earlier four.",
  apis: ["NASA/JPL Fireball"],
  category: "space",
  dataCode: code,
  rows: rows("fireball-log", wire),
  sampleVars: {"clock":"01:20","d0_r":4,"d0_x":153,"d0_y":94,"d1_r":2,"d1_x":158,"d1_y":92,"d2_r":3,"d2_x":172,"d2_y":76,"d3_r":3,"d3_x":185,"d3_y":52,"d4_r":3,"d4_x":217,"d4_y":84,"hero_alt":"27 km up","hero_date":"4 Oct 2026","hero_kt":"0.18","hero_pos":"41.8S 173.1W","hero_time":"14:14  47 days ago","hero_unit":"kt of TNT","hero_unit_x":68,"r1_alt":"37 km","r1_date":"15 Sep 22:26","r1_kt":"0.08","r1_pos":"37.6S 161.6W","r2_alt":"70 km","r2_date":"11 Sep 21:18","r2_kt":"0.20","r2_pos":"0.2S 129.6W","r3_alt":"38 km","r3_date":"11 Sep 12:12","r3_kt":"0.67","r3_pos":"54.4N 100.1W","r4_alt":"34 km","r4_date":"10 Sep 16:22","r4_kt":"0.33","r4_pos":"19.3S 28.1W"},
};

export default template;
