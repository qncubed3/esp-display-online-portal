import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Moon phase: tonight's moon drawn from primitives, with phase name, illumination, age,
// next full and new moon, and Melbourne moonrise/moonset.

// Moon disc on screen. Data and Draw both use these numbers.
const CX = 82;
const CY = 136;
const R = 69;
const STRIP = 2; // height of each shadow strip
const N = Math.ceil((2 * R + 1) / STRIP); // number of strips
const TOP = CY - R;

const code = String.raw`// Tonight's moon, computed from the date (no API): low-precision sun and moon longitudes
// (Meeus) give the elongation, which gives the phase, illumination, age and the next
// full and new moon. Moonrise and moonset come from the US Naval Observatory (free, no key).
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const SOUTH = true; // southern hemisphere: the moon looks flipped, waxing is lit on the LEFT

const CX = ${CX}, CY = ${CY}, R = ${R}, STRIP = ${STRIP}, N = ${N}; // keep in step with Draw
const TOP = CY - R;
const OFF = -100; // off-screen y for unused shadow strips

const DAY = 86400000;
const rad = (d) => (d * Math.PI) / 180;
const norm = (d) => ((d % 360) + 360) % 360;

// Elongation of the moon from the sun (0 new, 90 first quarter, 180 full, 270 last quarter).
function elong(ms) {
  const d = ms / DAY - 10957.5; // days since J2000.0
  const L = 280.46 + 0.9856474 * d;
  const g = rad(357.528 + 0.9856003 * d);
  const sun = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  const Lm = 218.316 + 13.176396 * d;
  const Mm = rad(134.963 + 13.064993 * d);
  const F = rad(93.272 + 13.22935 * d);
  const D = rad(297.85 + 12.190749 * d);
  const moon = Lm + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D) +
    0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(g) - 0.114 * Math.sin(2 * F);
  return norm(moon - sun);
}

// Time the elongation next reaches target (dir 1) or last reached it (dir -1).
function findPhase(t0, target, dir) {
  const rel = (t) => norm(elong(t) - target); // 0..360, rises through the month, wraps at target
  let a = t0, b = t0;
  for (let i = 0; i < 70; i++) {
    b = a + dir * DAY / 2;
    if (dir > 0 ? rel(b) < rel(a) : rel(b) > rel(a)) break; // wrapped past target
    a = b;
  }
  let lo = Math.min(a, b), hi = Math.max(a, b);
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (rel(m) > 180) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

const t = Date.now();
const e = elong(t);
const waxing = e < 180;
const illum = (1 - Math.cos(rad(e))) / 2;
const lastNew = findPhase(t, 0, -1);
const age = (t - lastNew) / DAY;
const nextFull = findPhase(t, 180, 1);
const nextNew = findPhase(t, 0, 1);

// Phase name: the four principal phases within about a day (12 degrees) of their instant.
let n1, n2;
if (e < 12 || e >= 348) { n1 = "New"; n2 = "Moon"; }
else if (e < 78) { n1 = "Waxing"; n2 = "Crescent"; }
else if (e < 102) { n1 = "First"; n2 = "Quarter"; }
else if (e < 168) { n1 = "Waxing"; n2 = "Gibbous"; }
else if (e < 192) { n1 = "Full"; n2 = "Moon"; }
else if (e < 258) { n1 = "Waning"; n2 = "Gibbous"; }
else if (e < 282) { n1 = "Last"; n2 = "Quarter"; }
else { n1 = "Waning"; n2 = "Crescent"; }
export const name1 = n1;
export const name2 = n2;
export const illum_pct = Math.round(illum * 100) + "%";
export const age_days = age.toFixed(1);

// Owner's UTC offset, from now() vs the real clock (rounded to 15 minutes).
const localMs = Date.UTC(Number(now("YYYY")), Number(now("MM")) - 1, Number(now("DD")), Number(now("HH")), Number(now("mm")));
const offMin = Math.round((localMs - t) / 60000 / 15) * 15;
const pad = (n) => (n < 10 ? "0" : "") + n;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function when(ms) {
  const d = new Date(ms + offMin * 60000);
  return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + "  " +
    pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}
export const next_full = when(nextFull);
export const next_new = when(nextNew);
export const full_in = "in " + ((nextFull - t) / DAY).toFixed(1) + " d";
export const new_in = "in " + ((nextNew - t) / DAY).toFixed(1) + " d";

export const place = PLACE + "  " + now("ddd") + " " + Number(now("DD")) + " " + MONTHS[Number(now("MM")) - 1];
export const clock = now("HH:mm");

// Moonrise and moonset today, local time.
let rise = "--:--", set = "--:--";
try {
  const r = await get(
    "https://aa.usno.navy.mil/api/rstt/oneday?date=" + now("YYYY-MM-DD") + "&coords=" + LAT + "," + LON + "&tz=" + offMin / 60,
    { cache: 3600 },
  );
  const md = (r && r.properties && r.properties.data && r.properties.data.moondata) || [];
  for (const p of md) {
    if (p.phen === "Rise") rise = p.time;
    if (p.phen === "Set") set = p.time;
  }
} catch (err) {
  console.log("USNO failed:", err.message);
}
export const moonrise = rise;
export const moonset = set;

// Shadow strips over a lit disc. For each strip, the terminator sits at c*cos(e) across the
// row's half-chord c and the shadow runs from there to the dark limb. c is the strip's widest
// chord plus a little, so no lit pixels peek out at the limb. Mirrored for the south.
const cosE = Math.cos(rad(e));
const strips = {};
for (let i = 0; i < N; i++) {
  const y0 = TOP + i * STRIP;
  const near = Math.min(Math.abs(y0 - CY), Math.abs(y0 + STRIP - CY));
  const inside = y0 < CY && y0 + STRIP > CY ? 0 : Math.max(0, near - 1);
  const cw = Math.sqrt(Math.max(0, R * R - inside * inside)) + 2;
  // Shadow span in "lit on the right" (north, waxing) coordinates.
  let a, b;
  if (waxing) { a = -cw; b = cw * cosE; } else { a = -cw * cosE; b = cw; }
  if (SOUTH) { const na = -b; b = -a; a = na; }
  const x0 = Math.round(CX + a);
  const w = Math.round(CX + b) - x0;
  strips["s" + i + "_x"] = x0;
  strips["s" + i + "_w"] = Math.max(0, w);
  strips["s" + i + "_y"] = w > 0 ? y0 : OFF;
}
${Array.from({ length: N }, (_, i) => `export const s${i}_x = strips.s${i}_x, s${i}_y = strips.s${i}_y, s${i}_w = strips.s${i}_w;`).join("\n")}
`;

const BG = "#000000";
const HEAD = "#101830";
const LIT = "#E8E2C8";
const SHADOW = "#1A1D26";
const LABEL = "#8A96B0";
const ACCENT = "#F0D890";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 28, HEAD],
  ["text", "{place}", 8, 14, 2, 1, "ML", "#C8D4E8"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Moon: lit disc, shadow strips, rim
  ["fillCircle", CX, CY, R, LIT],
  ...Array.from({ length: N }, (_, i): RawWireOp => ["fillRect", `{s${i}_x}`, `{s${i}_y}`, `{s${i}_w}`, STRIP, SHADOW]),
  ["drawCircle", CX, CY, R + 1, "#2A3040"],
  // Phase name
  ["text", "{name1}", 168, 36, 4, 1, "TL", ACCENT],
  ["text", "{name2}", 168, 62, 4, 1, "TL", ACCENT],
  // Illumination and age
  ["text", "LIT", 168, 96, 1, 1, "TL", LABEL],
  ["text", "AGE (DAYS)", 238, 96, 1, 1, "TL", LABEL],
  ["text", "{illum_pct}", 168, 106, 4, 1, "TL", "#FFFFFF"],
  ["text", "{age_days}", 238, 106, 4, 1, "TL", "#FFFFFF"],
  ["drawFastHLine", 168, 138, 144, "#2A3448"],
  // Next full and new
  ["text", "NEXT FULL", 168, 144, 1, 1, "TL", LABEL],
  ["text", "{full_in}", 312, 144, 1, 1, "TR", LABEL],
  ["text", "{next_full}", 168, 154, 2, 1, "TL", "#FFFFFF"],
  ["text", "NEXT NEW", 168, 176, 1, 1, "TL", LABEL],
  ["text", "{new_in}", 312, 176, 1, 1, "TR", LABEL],
  ["text", "{next_new}", 168, 186, 2, 1, "TL", "#FFFFFF"],
  ["drawFastHLine", 168, 206, 144, "#2A3448"],
  // Moonrise and moonset
  ["text", "RISE", 168, 212, 1, 1, "TL", LABEL],
  ["text", "SET", 242, 212, 1, 1, "TL", LABEL],
  ["text", "{moonrise}", 168, 222, 2, 1, "TL", "#FFFFFF"],
  ["text", "{moonset}", 242, 222, 2, 1, "TL", "#FFFFFF"],
];

const template: Template = {
  id: "moon-phase",
  name: "Moon phase",
  description: "Tonight's moon drawn to its current phase, with illumination, age, the next full and new moon, and moonrise and moonset.",
  apis: ["USNO", "now()"],
  category: "space",
  dataCode: code,
  rows: rows("moon-phase", wire),
  sampleVars: {"age_days":"11.3","clock":"01:13","full_in":"in 4.0 d","illum_pct":"80%","moonrise":"16:30","moonset":"03:20","name1":"Waxing","name2":"Gibbous","new_in":"in 18.4 d","next_full":"Wed 25 Nov  02:14","next_new":"Wed 9 Dec  11:57","place":"MELBOURNE  Sat 21 Nov","s0_w":9,"s0_x":95,"s0_y":67,"s10_w":21,"s10_x":114,"s10_y":87,"s11_w":22,"s11_x":115,"s11_y":89,"s12_w":23,"s12_x":116,"s12_y":91,"s13_w":24,"s13_x":116,"s13_y":93,"s14_w":25,"s14_x":117,"s14_y":95,"s15_w":25,"s15_x":118,"s15_y":97,"s16_w":25,"s16_x":119,"s16_y":99,"s17_w":26,"s17_x":119,"s17_y":101,"s18_w":26,"s18_x":120,"s18_y":103,"s19_w":26,"s19_x":121,"s19_y":105,"s1_w":12,"s1_x":98,"s1_y":69,"s20_w":27,"s20_x":121,"s20_y":107,"s21_w":28,"s21_x":121,"s21_y":109,"s22_w":27,"s22_x":122,"s22_y":111,"s23_w":28,"s23_x":122,"s23_y":113,"s24_w":28,"s24_x":123,"s24_y":115,"s25_w":28,"s25_x":123,"s25_y":117,"s26_w":29,"s26_x":123,"s26_y":119,"s27_w":29,"s27_x":123,"s27_y":121,"s28_w":28,"s28_x":124,"s28_y":123,"s29_w":29,"s29_x":124,"s29_y":125,"s2_w":13,"s2_x":101,"s2_y":71,"s30_w":29,"s30_x":124,"s30_y":127,"s31_w":29,"s31_x":124,"s31_y":129,"s32_w":29,"s32_x":124,"s32_y":131,"s33_w":29,"s33_x":124,"s33_y":133,"s34_w":29,"s34_x":124,"s34_y":135,"s35_w":29,"s35_x":124,"s35_y":137,"s36_w":29,"s36_x":124,"s36_y":139,"s37_w":29,"s37_x":124,"s37_y":141,"s38_w":29,"s38_x":124,"s38_y":143,"s39_w":29,"s39_x":124,"s39_y":145,"s3_w":15,"s3_x":103,"s3_y":73,"s40_w":28,"s40_x":124,"s40_y":147,"s41_w":29,"s41_x":123,"s41_y":149,"s42_w":29,"s42_x":123,"s42_y":151,"s43_w":28,"s43_x":123,"s43_y":153,"s44_w":28,"s44_x":123,"s44_y":155,"s45_w":28,"s45_x":122,"s45_y":157,"s46_w":27,"s46_x":122,"s46_y":159,"s47_w":28,"s47_x":121,"s47_y":161,"s48_w":27,"s48_x":121,"s48_y":163,"s49_w":26,"s49_x":121,"s49_y":165,"s4_w":16,"s4_x":105,"s4_y":75,"s50_w":26,"s50_x":120,"s50_y":167,"s51_w":26,"s51_x":119,"s51_y":169,"s52_w":25,"s52_x":119,"s52_y":171,"s53_w":25,"s53_x":118,"s53_y":173,"s54_w":25,"s54_x":117,"s54_y":175,"s55_w":24,"s55_x":116,"s55_y":177,"s56_w":23,"s56_x":116,"s56_y":179,"s57_w":22,"s57_x":115,"s57_y":181,"s58_w":21,"s58_x":114,"s58_y":183,"s59_w":21,"s59_x":113,"s59_y":185,"s5_w":17,"s5_x":107,"s5_y":77,"s60_w":21,"s60_x":111,"s60_y":187,"s61_w":19,"s61_x":110,"s61_y":189,"s62_w":18,"s62_x":109,"s62_y":191,"s63_w":17,"s63_x":107,"s63_y":193,"s64_w":16,"s64_x":105,"s64_y":195,"s65_w":15,"s65_x":103,"s65_y":197,"s66_w":13,"s66_x":101,"s66_y":199,"s67_w":12,"s67_x":98,"s67_y":201,"s68_w":9,"s68_x":95,"s68_y":203,"s69_w":6,"s69_x":90,"s69_y":205,"s6_w":18,"s6_x":109,"s6_y":79,"s7_w":19,"s7_x":110,"s7_y":81,"s8_w":21,"s8_x":111,"s8_y":83,"s9_w":21,"s9_x":113,"s9_y":85},
};

export default template;
