import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Space weather

// Kp bar chart box. Data and Draw both use these numbers.
const CH_X = 126; // left edge of the first bar slot
const SLOT = 23; // width of one 3-hour slot
const BAR_W = 19;
const CH_BASE = 136; // y of Kp 0
const PX_PER_KP = 10; // Kp 9 sits at y 46

const code = String.raw`// Aurora and space weather from NOAA SWPC (free, no key).
// Current planetary Kp (1-minute estimate), the last 24 hours of 3-hour Kp,
// and the latest solar wind speed and magnetic field (Bz, Bt) at L1.
const CH_X = ${CH_X}, SLOT = ${SLOT}, CH_BASE = ${CH_BASE}, PX_PER_KP = ${PX_PER_KP}; // keep in step with Draw
const OFF = -200; // off-screen y for bars with no data
const BASE = "https://services.swpc.noaa.gov/";

async function load(path) {
  try {
    return await get(BASE + path, { cache: 600 });
  } catch (e) {
    return null;
  }
}

const kp3 = await load("products/noaa-planetary-k-index.json");
const kp1 = await load("json/planetary_k_index_1m.json");
const wind = await load("products/summary/solar-wind-speed.json");
const mag = await load("products/summary/solar-wind-mag-field.json");

function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) ? n : null;
}

// 3-hour Kp: array of { time_tag, Kp }. Older feeds were arrays with a header row.
const hist = [];
if (Array.isArray(kp3)) {
  for (const r of kp3) {
    if (Array.isArray(r)) {
      const k = num(r[1]);
      if (k !== null) hist.push({ t: String(r[0]), kp: k });
    } else if (r && num(r.Kp) !== null) {
      hist.push({ t: String(r.time_tag), kp: num(r.Kp) });
    }
  }
}
const last8 = hist.slice(-8);

// Current Kp: latest 1-minute estimate, else the latest 3-hour value.
let kp = null;
if (Array.isArray(kp1) && kp1.length) {
  const r = kp1[kp1.length - 1];
  kp = num(r && (r.estimated_kp ?? r.kp_index));
}
if (kp === null && last8.length) kp = last8[last8.length - 1].kp;

function kpCol(k) {
  const lv = Math.round(k);
  return lv >= 5 ? "#FF4040" : lv >= 4 ? "#FFD020" : "#30D060";
}
const STORM = ["G1 Minor", "G2 Moderate", "G3 Strong", "G4 Severe", "G5 Extreme"];

const lv = kp === null ? -1 : Math.round(kp);
export const kp_val = kp === null ? "--" : kp.toFixed(1);
export const kp_col = kp === null ? "#808080" : kpCol(kp);
export const kp_status = kp === null ? "No data" : lv >= 5 ? STORM[Math.min(lv, 9) - 5] : lv === 4 ? "Active" : lv === 3 ? "Unsettled" : "Quiet";
export const kp_sub = kp === null ? "" : lv >= 5 ? "geomagnetic storm" : "geomagnetic field";

// Aurora chance for southern Australia (Tasmania, southern Victoria).
export const aurora = kp === null ? "--" : lv >= 7 ? "Likely" : lv >= 5 ? "Possible" : "Low";
export const aurora_col = kp === null ? "#808080" : lv >= 7 ? "#40FF80" : lv >= 5 ? "#FFD020" : "#A0A0A0";

// Owner's UTC offset in minutes, to label bars in local time.
const d = new Date();
let off = parseInt(now("HH"), 10) * 60 + parseInt(now("mm"), 10) - (d.getUTCHours() * 60 + d.getUTCMinutes());
if (off > 14 * 60) off -= 1440;
if (off < -12 * 60) off += 1440;

function localHour(tag) {
  const m = /T(\d\d):(\d\d)/.exec(tag);
  if (!m) return "";
  const mins = (((parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + off) % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  return (h < 10 ? "0" : "") + h;
}

// Bars b1..b8, oldest to newest; missing slots are pushed off-screen.
const pad = 8 - last8.length;
const Y = [], H = [], C = [], T = [];
for (let i = 0; i < 8; i++) {
  const r = i >= pad ? last8[i - pad] : null;
  const h = r ? Math.max(2, Math.round(Math.min(r.kp, 9) * PX_PER_KP)) : 0;
  Y.push(r ? CH_BASE - h : OFF);
  H.push(h);
  C.push(r ? kpCol(r.kp) : "#000000");
  T.push(r ? localHour(r.t) : "");
}
export const b1_y = Y[0], b1_h = H[0], b1_c = C[0], b1_t = T[0];
export const b2_y = Y[1], b2_h = H[1], b2_c = C[1], b2_t = T[1];
export const b3_y = Y[2], b3_h = H[2], b3_c = C[2], b3_t = T[2];
export const b4_y = Y[3], b4_h = H[3], b4_c = C[3], b4_t = T[3];
export const b5_y = Y[4], b5_h = H[4], b5_c = C[4], b5_t = T[4];
export const b6_y = Y[5], b6_h = H[5], b6_c = C[5], b6_t = T[5];
export const b7_y = Y[6], b7_h = H[6], b7_c = C[6], b7_t = T[6];
export const b8_y = Y[7], b8_h = H[7], b8_c = C[7], b8_t = T[7];
export const chart_note = last8.length ? "" : "No Kp history";

// Solar wind: [{ proton_speed }] and [{ bt, bz_gsm }].
const w = Array.isArray(wind) && wind.length ? num(wind[0].proton_speed) : null;
const m0 = Array.isArray(mag) && mag.length ? mag[0] : null;
const bz = m0 ? num(m0.bz_gsm) : null;
const bt = m0 ? num(m0.bt) : null;
export const speed = w === null ? "--" : String(Math.round(w));
export const speed_col = w === null ? "#808080" : w >= 600 ? "#FF4040" : w >= 500 ? "#FFD020" : "#FFFFFF";
export const bz_val = bz === null ? "--" : (bz > 0 ? "+" : "") + Math.round(bz);
// Southward (negative) Bz couples with Earth's field and drives aurora.
export const bz_col = bz === null ? "#808080" : bz <= -10 ? "#FF4040" : bz <= -5 ? "#FFD020" : "#FFFFFF";
export const bt_val = bt === null ? "--" : String(Math.round(bt));

export const clock = now("HH:mm");
`;

const BG = "#000000";
const HEAD = "#1A1040";
const CARD = "#151A30";
const LABEL = "#9098C0";
const GRID = "#2A2E48";

const bar = (i: number): RawWireOp => [
  "fillRect",
  CH_X + (i - 1) * SLOT + (SLOT - BAR_W) / 2,
  `{b${i}_y}`,
  BAR_W,
  `{b${i}_h}`,
  `{b${i}_c}`,
];
const hourLabel = (i: number): RawWireOp => [
  "text",
  `{b${i}_t}`,
  CH_X + (i - 1) * SLOT + SLOT / 2,
  CH_BASE + 5,
  1,
  1,
  "TC",
  LABEL,
];
const gridAt = (k: number, col: string): RawWireOp => [
  "drawFastHLine",
  CH_X,
  CH_BASE - k * PX_PER_KP,
  8 * SLOT,
  col,
];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, HEAD],
  ["text", "SPACE WEATHER", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C8C0F0"],
  // Current Kp
  ["text", "PLANETARY Kp", 60, 36, 1, 1, "TC", LABEL],
  ["text", "{kp_val}", 60, 50, 4, 2, "TC", "{kp_col}"],
  ["text", "{kp_status}", 60, 108, 2, 1, "TC", "{kp_col}"],
  ["text", "{kp_sub}", 60, 127, 1, 1, "TC", LABEL],
  // Kp chart: grid at 3, 6 and 9, storm line at 5
  ["text", "Kp, LAST 24 H", CH_X, 36, 1, 1, "TL", LABEL],
  gridAt(3, GRID),
  gridAt(6, GRID),
  gridAt(9, GRID),
  ["drawFastHLine", CH_X, CH_BASE - 5 * PX_PER_KP, 8 * SLOT, "#602828"],
  ["text", "G1", CH_X + 8 * SLOT, CH_BASE - 5 * PX_PER_KP - 2, 1, 1, "BR", "#A04040"],
  bar(1),
  bar(2),
  bar(3),
  bar(4),
  bar(5),
  bar(6),
  bar(7),
  bar(8),
  ["drawFastHLine", CH_X, CH_BASE, 8 * SLOT, "#6870A0"],
  hourLabel(1),
  hourLabel(2),
  hourLabel(3),
  hourLabel(4),
  hourLabel(5),
  hourLabel(6),
  hourLabel(7),
  hourLabel(8),
  ["text", "{chart_note}", CH_X + 4 * SLOT, CH_BASE - 15, 2, 1, "MC", "#808080"],
  // Solar wind cards
  ["fillRoundRect", 8, 156, 96, 44, 6, CARD],
  ["fillRoundRect", 112, 156, 96, 44, 6, CARD],
  ["fillRoundRect", 216, 156, 96, 44, 6, CARD],
  ["text", "WIND km/s", 56, 162, 1, 1, "TC", LABEL],
  ["text", "Bz nT", 160, 162, 1, 1, "TC", LABEL],
  ["text", "Bt nT", 264, 162, 1, 1, "TC", LABEL],
  ["text", "{speed}", 56, 173, 4, 1, "TC", "{speed_col}"],
  ["text", "{bz_val}", 160, 173, 4, 1, "TC", "{bz_col}"],
  ["text", "{bt_val}", 264, 173, 4, 1, "TC", "#FFFFFF"],
  // Aurora chance
  ["fillRoundRect", 8, 206, 304, 28, 6, CARD],
  ["text", "Aurora chance, southern Australia", 16, 220, 2, 1, "ML", "#D0D0E0"],
  ["text", "{aurora}", 304, 220, 2, 1, "MR", "{aurora_col}"],
];

const template: Template = {
  id: "space-weather",
  name: "Space Weather",
  description: "Current planetary Kp with storm level, a 24-hour Kp bar chart, solar wind speed and Bz, and the aurora chance in southern Australia.",
  apis: ["NOAA SWPC"],
  category: "space",
  dataCode: code,
  rows: rows("space-weather", wire),
  sampleVars: {"aurora": "Low", "aurora_col": "#A0A0A0", "b1_c": "#30D060", "b1_h": 20, "b1_t": "23", "b1_y": 116, "b2_c": "#30D060", "b2_h": 27, "b2_t": "02", "b2_y": 109, "b3_c": "#30D060", "b3_h": 30, "b3_t": "05", "b3_y": 106, "b4_c": "#30D060", "b4_h": 13, "b4_t": "08", "b4_y": 123, "b5_c": "#30D060", "b5_h": 7, "b5_t": "11", "b5_y": 129, "b6_c": "#30D060", "b6_h": 20, "b6_t": "14", "b6_y": 116, "b7_c": "#30D060", "b7_h": 13, "b7_t": "17", "b7_y": 123, "b8_c": "#30D060", "b8_h": 7, "b8_t": "20", "b8_y": 129, "bt_val": "5", "bz_col": "#FFFFFF", "bz_val": "0", "chart_note": "", "clock": "01:10", "kp_col": "#30D060", "kp_status": "Quiet", "kp_sub": "geomagnetic field", "kp_val": "0.0", "speed": "380", "speed_col": "#FFFFFF"},
};

export default template;
