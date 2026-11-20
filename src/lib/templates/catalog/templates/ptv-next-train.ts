import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// One big countdown to the next Melbourne Metro train from a platform, with the two after it.

const code = String.raw`// Minutes to the next train from one Melbourne Metro platform, shown big.
// Data from the project's PTV departures proxy (free, no key).
// Change STOP_ID / PLATFORM to your station (PTV stop id, e.g. G1005 = Altona).
const STOP_ID = "G1005";
const PLATFORM = "P1";

let ptv = null;
try {
  ptv = await get(
    "https://esp32-ptv-display-um8x.vercel.app/departures?stop_id=" + STOP_ID +
      "&platform=" + PLATFORM + "&limit=3",
    { cache: 30 },
  );
} catch (e) {
  console.log("ptv-next-train: " + e);
}

// Font 2 widths (chars 32-126), to size the badge and truncate names.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const ascii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "");
function w2(s) {
  let w = 0;
  for (const ch of s) w += W2[ch.charCodeAt(0) - 32] || 8;
  return w;
}
function fit2(s, max) {
  s = ascii(s);
  if (w2(s) <= max) return s;
  while (s.length > 1 && w2(s + "..") > max) s = s.slice(0, -1);
  return s.trim() + "..";
}

const stop = (ptv && ptv.stop) || {};
const deps = ptv && Array.isArray(ptv.departures) ? ptv.departures : [];
export const station = fit2(String(stop.name || "Metro").toUpperCase(), 190);
export const platform = stop.platform ? "PLATFORM " + ascii(stop.platform) : "";
export const clock = now("HH:mm");

const first = deps[0];
const remain = first && typeof first.remain === "number" ? Math.max(0, first.remain) : -1;
const lateMin = first ? Math.round((first.delay || 0) / 60) : 0;

export const label = first ? "NEXT TRAIN TO" : "";
// Font 4 at size 1 is about 14 px a character; keep the destination within the screen.
const dest = first ? ascii(first.dest || "Unknown") : "";
export const dest1 = dest.length > 20 ? dest.slice(0, 19) + "." : dest;

// Big number (font 4 x3: digits 42 px) with "min" (font 4 x1: 43 px) beside it, centred together.
const big = remain < 0 ? "" : remain === 0 ? "NOW" : String(remain);
export const mins = big;
const bigW = remain === 0 ? 0 : big.length * 42;
const unitW = remain > 0 ? 6 + 43 : 0;
export const mins_x = remain === 0 ? 160 : Math.round(160 - (bigW + unitW) / 2);
export const mins_datum = remain === 0 ? "TC" : "TL";
export const unit = remain > 0 ? "min" : "";
export const unit_x = mins_x + bigW + 6;
export const mins_col = remain < 0 ? "#FFFFFF" : remain <= 1 ? "#FF5A3C" : remain <= 5 ? "#FFB020" : "#3CE07A";

// Badge: departure time and delay, in a pill sized to the text.
const badgeText = first
  ? ascii(first.time || "--:--") + "  " + (lateMin > 0 ? lateMin + " MIN LATE" : "ON TIME")
  : "";
export const badge = badgeText;
const bw = first ? w2(badgeText) + 20 : 0;
export const badge_x = first ? Math.round(160 - bw / 2) : -400;
export const badge_w = bw;
export const badge_col = lateMin > 0 ? "#B02020" : "#1C7A3E";

// The two following departures.
function row(d) {
  if (!d) return { dest: "", time: "", min: "" };
  const r = typeof d.remain === "number" ? d.remain : -1;
  const late = Math.round((d.delay || 0) / 60);
  return {
    dest: fit2(d.dest || "Unknown", 150),
    time: ascii(d.time || "") + (late > 0 ? " +" + late : ""),
    min: r < 0 ? "" : r === 0 ? "now" : r + " min",
  };
}
const a = row(deps[1]);
const b = row(deps[2]);
export const dest2 = a.dest, time2 = a.time, min2 = a.min;
export const dest3 = b.dest, time3 = b.time, min3 = b.min;
export const then_label = deps.length > 1 ? "THEN" : "";

export const none = ptv ? (deps.length ? "" : "NO DEPARTURES") : "NO DATA";
`;

const BG = "#06121F";
const HDR = "#0072CE"; // Metro blue
const GREY = "#8FA3B8";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 28, HDR],
  ["text", "{station}", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  ["text", "{platform}", 252, 14, 1, 1, "MR", "#D0E4F8"],
  // Destination
  ["text", "{label}", 160, 38, 1, 1, "TC", GREY],
  ["text", "{dest1}", 160, 50, 4, 1, "TC", "#FFFFFF"],
  // Big countdown
  ["text", "{mins}", "{mins_x}", 82, 4, 3, "{mins_datum}", "{mins_col}"],
  ["text", "{unit}", "{unit_x}", 156, 4, 1, "BL", "{mins_col}"],
  // Departure time + delay badge
  ["fillRoundRect", "{badge_x}", 164, "{badge_w}", 22, 11, "{badge_col}"],
  ["text", "{badge}", 160, 175, 2, 1, "MC", "#FFFFFF"],
  // Following departures
  ["drawFastHLine", 8, 194, 304, "#2A3E55"],
  ["text", "{then_label}", 8, 199, 1, 1, "TL", GREY],
  ["text", "{dest2}", 40, 196, 2, 1, "TL", "#E0E8F0"],
  ["text", "{time2}", 230, 196, 2, 1, "TR", GREY],
  ["text", "{min2}", 312, 196, 2, 1, "TR", "#FFFFFF"],
  ["text", "{dest3}", 40, 217, 2, 1, "TL", "#E0E8F0"],
  ["text", "{time3}", 230, 217, 2, 1, "TR", GREY],
  ["text", "{min3}", 312, 217, 2, 1, "TR", "#FFFFFF"],
  ["text", "{none}", 160, 120, 4, 1, "MC", "#FF5A3C"],
];

const template: Template = {
  id: "ptv-next-train",
  name: "Next train countdown",
  description: "A big countdown to the next Melbourne Metro train from your platform, with its delay and the two trains after it.",
  apis: ["PTV departures proxy"],
  category: "transport",
  dataCode: code,
  rows: rows("ptv-next-train", wire),
  sampleVars: {"badge":"01:38  ON TIME","badge_col":"#1C7A3E","badge_w":119,"badge_x":101,"clock":"01:24","dest1":"Werribee","dest2":"Flinders Street","dest3":"Werribee","label":"NEXT TRAIN TO","min2":"47 min","min3":"60 min","mins":"13","mins_col":"#3CE07A","mins_datum":"TL","mins_x":94,"none":"","platform":"PLATFORM 1","station":"ALTONA","then_label":"THEN","time2":"02:12","time3":"02:25","unit":"min","unit_x":184},
};

export default template;
