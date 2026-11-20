import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// London Underground status board: all 11 tube lines, each on its official colour, with the live status.

const TOP = 25; // y of the first line row
const ROW_H = 19;
const BLOCK_W = 140;

const code = String.raw`// London Underground line status from the TfL Unified API (keyless, about 50 requests/min).
// One row per tube line on its official colour; the status is green for Good Service,
// amber for delays and red for severe delays, suspensions and closures.
const URL = "https://api.tfl.gov.uk/Line/Mode/tube/Status";

// line id -> [display name, block colour, text colour]
const LINES = [
  ["bakerloo", "Bakerloo", "#B36305", "#FFFFFF"],
  ["central", "Central", "#E32017", "#FFFFFF"],
  ["circle", "Circle", "#FFD300", "#000000"],
  ["district", "District", "#00782A", "#FFFFFF"],
  ["hammersmith-city", "Hammersmith & City", "#F3A9BB", "#000000"],
  ["jubilee", "Jubilee", "#A0A5A9", "#000000"],
  ["metropolitan", "Metropolitan", "#9B0056", "#FFFFFF"],
  ["northern", "Northern", "#303030", "#FFFFFF"], // officially black; lifted so it shows on the dark screen
  ["piccadilly", "Piccadilly", "#003688", "#FFFFFF"],
  ["victoria", "Victoria", "#0098D4", "#FFFFFF"],
  ["waterloo-city", "Waterloo & City", "#95CDBA", "#000000"],
];

const GOOD = "#3ECF8E", AMBER = "#FFB020", RED = "#FF5A5F", GREY = "#A0A0A0";

// Font 2 widths (char code - 32) for fitting the status text.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const width = (s) => { let w = 0; for (const ch of s) w += W2[ch.charCodeAt(0) - 32] || 7; return w; };
function fit(s, max) {
  if (width(s) <= max) return s;
  while (s.length > 1 && width(s + ".") > max) s = s.slice(0, -1);
  return s.trimEnd() + ".";
}
const ascii = (s) => String(s || "").replace(/[^\x20-\x7E]/g, "").trim();

// TfL severity: 10 = Good Service, lower numbers are worse; 18/19 are info only, 20 = closed for the night.
function rank(sev) {
  if (sev === 10) return 100;
  if (sev === 18 || sev === 19) return 90;
  if (sev === 20) return 80;
  return sev;
}
function colour(sev) {
  if (sev === 10 || sev === 18 || sev === 19) return GOOD;
  if (sev === 20) return GREY;
  if (sev <= 6 || sev === 16) return RED;
  return AMBER;
}

let data = null;
try {
  const r = await get(URL, { cache: 120 });
  if (Array.isArray(r)) data = r;
} catch (e) {
  console.log("tfl-tube-status: " + e.message);
}

const byId = {};
for (const l of data || []) if (l && l.id) byId[l.id] = l;

let disrupted = 0, known = 0;
const out = LINES.map((def) => {
  const l = byId[def[0]];
  const st = l && Array.isArray(l.lineStatuses) ? l.lineStatuses : [];
  let worst = null;
  for (const s of st) {
    if (typeof s.statusSeverity !== "number") continue;
    if (!worst || rank(s.statusSeverity) < rank(worst.statusSeverity)) worst = s;
  }
  if (!worst) return { name: def[1], bg: def[2], fg: def[3], status: data ? "No data" : "--", col: GREY };
  known++;
  const sev = worst.statusSeverity;
  if (colour(sev) !== GOOD && sev !== 20) disrupted++;
  let txt = ascii(worst.statusSeverityDescription) || "Unknown";
  if (st.length > 1 && sev !== 10) txt += " +" + (st.length - 1);
  return { name: def[1], bg: def[2], fg: def[3], status: fit(txt, 156), col: colour(sev) };
});

export const time = now("HH:mm");
export const summary = known === 0 ? "No data" : disrupted === 0 ? "Good service" : disrupted + " disrupted";
export const summary_col = known === 0 ? GREY : disrupted === 0 ? GOOD : AMBER;

export const l1_name = out[0].name, l1_bg = out[0].bg, l1_fg = out[0].fg, l1_status = out[0].status, l1_col = out[0].col;
export const l2_name = out[1].name, l2_bg = out[1].bg, l2_fg = out[1].fg, l2_status = out[1].status, l2_col = out[1].col;
export const l3_name = out[2].name, l3_bg = out[2].bg, l3_fg = out[2].fg, l3_status = out[2].status, l3_col = out[2].col;
export const l4_name = out[3].name, l4_bg = out[3].bg, l4_fg = out[3].fg, l4_status = out[3].status, l4_col = out[3].col;
export const l5_name = out[4].name, l5_bg = out[4].bg, l5_fg = out[4].fg, l5_status = out[4].status, l5_col = out[4].col;
export const l6_name = out[5].name, l6_bg = out[5].bg, l6_fg = out[5].fg, l6_status = out[5].status, l6_col = out[5].col;
export const l7_name = out[6].name, l7_bg = out[6].bg, l7_fg = out[6].fg, l7_status = out[6].status, l7_col = out[6].col;
export const l8_name = out[7].name, l8_bg = out[7].bg, l8_fg = out[7].fg, l8_status = out[7].status, l8_col = out[7].col;
export const l9_name = out[8].name, l9_bg = out[8].bg, l9_fg = out[8].fg, l9_status = out[8].status, l9_col = out[8].col;
export const l10_name = out[9].name, l10_bg = out[9].bg, l10_fg = out[9].fg, l10_status = out[9].status, l10_col = out[9].col;
export const l11_name = out[10].name, l11_bg = out[10].bg, l11_fg = out[10].fg, l11_status = out[10].status, l11_col = out[10].col;
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 22, "#0B1A3A"],
  ["fillCircle", 14, 11, 7, "#DC241F"],
  ["fillCircle", 14, 11, 4, "#0B1A3A"],
  ["fillRect", 4, 9, 20, 5, "#0019A8"],
  ["text", "TUBE STATUS", 30, 11, 2, 1, "ML", "#FFFFFF"],
  ["text", "{summary}", 268, 11, 2, 1, "MR", "{summary_col}"],
  ["text", "{time}", 314, 11, 2, 1, "MR", "#A0A0A0"],
  ...Array.from({ length: 11 }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    return [
      ["fillRect", 6, y, BLOCK_W, ROW_H - 2, `{l${n}_bg}`],
      ["text", `{l${n}_name}`, 11, y + 9, 2, 1, "ML", `{l${n}_fg}`],
      ["text", `{l${n}_status}`, 314, y + 9, 2, 1, "MR", `{l${n}_col}`],
    ];
  }).flat(),
];

const template: Template = {
  id: "tfl-tube-status",
  name: "London Tube status",
  description: "All 11 London Underground lines on their official colours with live Good Service, delay or closure status.",
  apis: ["TfL"],
  category: "transport",
  dataCode: code,
  rows: rows("tfl-tube-status", wire),
  sampleVars: {"l10_bg":"#0098D4","l10_col":"#3ECF8E","l10_fg":"#FFFFFF","l10_name":"Victoria","l10_status":"Good Service","l11_bg":"#95CDBA","l11_col":"#3ECF8E","l11_fg":"#000000","l11_name":"Waterloo & City","l11_status":"Good Service","l1_bg":"#B36305","l1_col":"#FFB020","l1_fg":"#FFFFFF","l1_name":"Bakerloo","l1_status":"Minor Delays","l2_bg":"#E32017","l2_col":"#FFB020","l2_fg":"#FFFFFF","l2_name":"Central","l2_status":"Minor Delays","l3_bg":"#FFD300","l3_col":"#3ECF8E","l3_fg":"#000000","l3_name":"Circle","l3_status":"Good Service","l4_bg":"#00782A","l4_col":"#FF5A5F","l4_fg":"#FFFFFF","l4_name":"District","l4_status":"Part Closure +1","l5_bg":"#F3A9BB","l5_col":"#3ECF8E","l5_fg":"#000000","l5_name":"Hammersmith & City","l5_status":"Good Service","l6_bg":"#A0A5A9","l6_col":"#3ECF8E","l6_fg":"#000000","l6_name":"Jubilee","l6_status":"Good Service","l7_bg":"#9B0056","l7_col":"#3ECF8E","l7_fg":"#FFFFFF","l7_name":"Metropolitan","l7_status":"Good Service","l8_bg":"#303030","l8_col":"#3ECF8E","l8_fg":"#FFFFFF","l8_name":"Northern","l8_status":"Good Service","l9_bg":"#003688","l9_col":"#FF5A5F","l9_fg":"#FFFFFF","l9_name":"Piccadilly","l9_status":"Planned Closure","summary":"4 disrupted","summary_col":"#FFB020","time":"08:42"},
};

export default template;
