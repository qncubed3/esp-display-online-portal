import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// Next three trains from both platforms of one Melbourne Metro station, side by side.
// Data: the project's PTV departures proxy (one request per platform).
// Change STOP_ID to your station's PTV stop id. Pick a station with two platforms
// (single-platform stations such as Altona G1005 have no P2).
const STOP_ID = "G1001"; // Southland
const LEFT = "P1";
const RIGHT = "P2";

const base = "https://esp32-ptv-display-um8x.vercel.app/departures?stop_id=" + STOP_ID + "&limit=3&platform=";

async function load(p) {
  try {
    return await get(base + p, { cache: 30 });
  } catch (e) {
    console.log("PTV " + p + " failed:", e.message);
    return null;
  }
}
const [a, b] = await Promise.all([load(LEFT), load(RIGHT)]);

function ascii(s) {
  return String(s || "").replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "");
}
function short(s, n) {
  s = ascii(s).replace(/ Street$/, " St");
  return s.length > n ? s.slice(0, n - 1).trim() + "." : s;
}

const stopInfo = (a && a.stop) || (b && b.stop) || {};
export const station = short(stopInfo.name || "PTV", 22).toUpperCase();
export const clock = now("HH:mm");

function column(res, p) {
  const deps = res && Array.isArray(res.departures) ? res.departures.slice(0, 3) : [];
  const plat = res && res.stop && res.stop.platform ? res.stop.platform : p.replace(/^P/, "");
  const out = { head: "PLATFORM " + plat, none: "", sep1: deps.length > 1 ? 111 : -200, sep2: deps.length > 2 ? 169 : -200 };
  if (!res) out.none = "No data";
  else if (!deps.length) out.none = "No trains";
  for (let i = 0; i < 3; i++) {
    const d = deps[i];
    const r = "r" + (i + 1);
    if (!d) {
      out[r + "_min"] = ""; out[r + "_unit"] = ""; out[r + "_dest"] = "";
      out[r + "_time"] = ""; out[r + "_late"] = ""; out[r + "_col"] = "#FFFFFF";
      continue;
    }
    const remain = typeof d.remain === "number" ? Math.max(0, d.remain) : -1;
    const late = Math.round((d.delay || 0) / 60);
    out[r + "_min"] = remain < 0 ? "--" : remain === 0 ? "Now" : String(remain);
    out[r + "_unit"] = remain > 0 ? "min" : "";
    out[r + "_col"] = remain >= 0 && remain <= 2 ? "#FFA500" : "#00E070";
    out[r + "_dest"] = short(d.dest || "Unknown", 15);
    out[r + "_time"] = ascii(d.time || "--:--");
    out[r + "_late"] = late > 0 ? "+" + late + "m late" : "";
  }
  return out;
}
const L = column(a, LEFT), R = column(b, RIGHT);

export const l_head = L.head, l_none = L.none, l_sep1 = L.sep1, l_sep2 = L.sep2;
export const l1_min = L.r1_min, l1_unit = L.r1_unit, l1_col = L.r1_col, l1_dest = L.r1_dest, l1_time = L.r1_time, l1_late = L.r1_late;
export const l2_min = L.r2_min, l2_unit = L.r2_unit, l2_col = L.r2_col, l2_dest = L.r2_dest, l2_time = L.r2_time, l2_late = L.r2_late;
export const l3_min = L.r3_min, l3_unit = L.r3_unit, l3_col = L.r3_col, l3_dest = L.r3_dest, l3_time = L.r3_time, l3_late = L.r3_late;
export const r_head = R.head, r_none = R.none, r_sep1 = R.sep1, r_sep2 = R.sep2;
export const r1_min = R.r1_min, r1_unit = R.r1_unit, r1_col = R.r1_col, r1_dest = R.r1_dest, r1_time = R.r1_time, r1_late = R.r1_late;
export const r2_min = R.r2_min, r2_unit = R.r2_unit, r2_col = R.r2_col, r2_dest = R.r2_dest, r2_time = R.r2_time, r2_late = R.r2_late;
export const r3_min = R.r3_min, r3_unit = R.r3_unit, r3_col = R.r3_col, r3_dest = R.r3_dest, r3_time = R.r3_time, r3_late = R.r3_late;
`;

const ROW_Y = [56, 114, 172];

function col(side: "l" | "r", x0: number): RawWireOp[] {
  const x1 = x0 + 144; // right edge of the column
  const ops: RawWireOp[] = [
    ["fillRect", x0 - 4, 32, 152, 18, "#14204A"],
    ["text", `{${side}_head}`, x0, 41, 2, 1, "ML", "#8FB4FF"],
    ["text", `{${side}_none}`, x0 + 72, 130, 2, 1, "MC", "#A0A0A0"],
  ];
  ROW_Y.forEach((y, i) => {
    const n = i + 1;
    ops.push(
      ["text", `{${side}${n}_min}`, x0 + 44, y + 13, 4, 1, "MR", `{${side}${n}_col}`],
      ["text", `{${side}${n}_unit}`, x0 + 48, y + 16, 2, 1, "ML", "#A0A0A0"],
      ["text", `{${side}${n}_time}`, x1, y + 13, 2, 1, "MR", "#FFFF00"],
      ["text", `{${side}${n}_dest}`, x0, y + 37, 2, 1, "ML", "#FFFFFF"],
      ["text", `{${side}${n}_late}`, x1, y + 50, 1, 1, "MR", "#FF5050"],
    );
  });
  return ops;
}

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#000080"],
  ["text", "{station}", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  ["drawFastVLine", 160, 32, 202, "#404040"],
  ["drawFastHLine", 8, "{l_sep1}", 144, "#303030"],
  ["drawFastHLine", 8, "{l_sep2}", 144, "#303030"],
  ["drawFastHLine", 168, "{r_sep1}", 144, "#303030"],
  ["drawFastHLine", 168, "{r_sep2}", 144, "#303030"],
  ...col("l", 8),
  ...col("r", 168),
];

const template: Template = {
  id: "ptv-both-directions",
  name: "Station both directions",
  description: "Next three trains from both platforms of a Melbourne Metro station, side by side.",
  apis: ["PTV departures proxy"],
  category: "transport",
  dataCode: code,
  rows: rows("ptv-both-directions", wire),
  sampleVars: {"clock":"01:26","l1_col":"#00E070","l1_dest":"Flinders St","l1_late":"+2m late","l1_min":"32","l1_time":"01:58","l1_unit":"min","l2_col":"#00E070","l2_dest":"Flinders St","l2_late":"","l2_min":"90","l2_time":"02:56","l2_unit":"min","l3_col":"#00E070","l3_dest":"Flinders St","l3_late":"","l3_min":"150","l3_time":"03:56","l3_unit":"min","l_head":"PLATFORM 1","l_none":"","l_sep1":111,"l_sep2":169,"r1_col":"#00E070","r1_dest":"Frankston","r1_late":"+2m late","r1_min":"18","r1_time":"01:44","r1_unit":"min","r2_col":"#00E070","r2_dest":"Frankston","r2_late":"+1m late","r2_min":"77","r2_time":"02:43","r2_unit":"min","r3_col":"#00E070","r3_dest":"Frankston","r3_late":"","r3_min":"136","r3_time":"03:42","r3_unit":"min","r_head":"PLATFORM 2","r_none":"","r_sep1":111,"r_sep2":169,"station":"SOUTHLAND"},
};

export default template;
