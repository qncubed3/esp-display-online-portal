import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// AFL ladder: the top 10 with wins, losses, percentage and points, and the finals cut lines

const TOP = 38; // y of the first ladder row
const ROW_H = 19; // 10 rows fill 38..228
const ROWS = 10;

const code = String.raw`// AFL ladder from Squiggle (api.squiggle.com.au, free, no key; it asks for a User-Agent,
// which the sandbox sends). Shows the top 10. A dim line marks the top 6 (straight into the
// finals) and an accent line the last finals spot (7th to 10th play the wildcard round).
// In the off-season it shows last season's final ladder and when the next season starts.
const TEAM = ""; // your team's full name, e.g. "Collingwood", to highlight its row
const DIRECT = 6; // line drawn under this rank
const FINALS = 10; // finals line drawn under this rank (move to 8 for the old top-8 format)
const ACCENT = "#4FC3F7";
const ROWS = 10, TOP = 38, ROW_H = 19;

const SHORT = {
  "Brisbane Lions": "Brisbane", "Greater Western Sydney": "GWS", "North Melbourne": "North Melb",
  "Port Adelaide": "Port Adel", "Western Bulldogs": "Bulldogs",
};
function short(name) {
  const n = String(name || "");
  return SHORT[n] || n.replace(/[^A-Za-z ]/g, "").slice(0, 11);
}

async function fetchJson(url) {
  try {
    return await get(url, { cache: 1800 });
  } catch (e) {
    console.log("afl-ladder: " + e.message);
    return null;
  }
}
async function standings(y) {
  const d = await fetchJson("https://api.squiggle.com.au/?q=standings;year=" + y);
  return d && Array.isArray(d.standings) ? d.standings : null;
}

const year = Number(now("YYYY"));
let shownYear = year;
let ladder = await standings(year);
let nextYear = 0; // set when the shown season is over
let label = "";
if (ladder && !ladder.some((t) => t.played > 0)) {
  // Before round 1: show last season's final ladder.
  const prev = await standings(year - 1);
  if (prev && prev.some((t) => t.played > 0)) { ladder = prev; shownYear = year - 1; nextYear = year; }
}
if (ladder && !nextYear) {
  const open = await fetchJson("https://api.squiggle.com.au/?q=games;year=" + year + ";complete=!100");
  const left = open && Array.isArray(open.games) ? open.games : null;
  if (left && left.length === 0) nextYear = year + 1;
  else if (left) {
    left.sort((a, b) => a.unixtime - b.unixtime);
    label = left[0].is_final ? "Finals" : (left[0].roundname || ("Round " + left[0].round));
  }
}

// Off-season: find the first game of the next season.
let starts = "";
if (nextYear) {
  label = "Final ladder";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const g = await fetchJson("https://api.squiggle.com.au/?q=games;year=" + nextYear);
  const games = g && Array.isArray(g.games) ? g.games.filter((x) => typeof x.unixtime === "number") : [];
  games.sort((a, b) => a.unixtime - b.unixtime);
  const m = games.length ? /^\d{4}-(\d\d)-(\d\d)/.exec(String(games[0].date || "")) : null;
  starts = m ? "Starts " + Number(m[2]) + " " + MONTHS[Number(m[1]) - 1] : "Starts March";
}

const list = (ladder || []).slice().sort((a, b) => a.rank - b.rank);
const R = [];
for (let i = 0; i < ROWS; i++) {
  const t = list[i];
  const mine = t && TEAM && t.name === TEAM;
  if (!t) {
    R.push({ rk: "", tm: i === 0 ? (ladder ? "No ladder yet" : "No data") : "", w: "", l: "", pc: "", pt: "",
      bg: "#000000", rc: ACCENT });
    continue;
  }
  R.push({
    rk: String(t.rank),
    tm: short(t.name),
    w: String(t.wins || 0),
    l: String(t.losses || 0),
    pc: typeof t.percentage === "number" && t.percentage > 0 ? t.percentage.toFixed(1) : "-",
    pt: String(t.pts || 0),
    bg: mine ? "#3A2A00" : (i % 2 === 1 ? "#10161E" : "#000000"),
    rc: t.rank <= DIRECT ? ACCENT : (t.rank <= FINALS ? "#C0C0C0" : "#707070"),
  });
}
export const r1_rk = R[0].rk, r1_tm = R[0].tm, r1_w = R[0].w, r1_l = R[0].l, r1_pc = R[0].pc, r1_pt = R[0].pt, r1_bg = R[0].bg, r1_rc = R[0].rc;
export const r2_rk = R[1].rk, r2_tm = R[1].tm, r2_w = R[1].w, r2_l = R[1].l, r2_pc = R[1].pc, r2_pt = R[1].pt, r2_bg = R[1].bg, r2_rc = R[1].rc;
export const r3_rk = R[2].rk, r3_tm = R[2].tm, r3_w = R[2].w, r3_l = R[2].l, r3_pc = R[2].pc, r3_pt = R[2].pt, r3_bg = R[2].bg, r3_rc = R[2].rc;
export const r4_rk = R[3].rk, r4_tm = R[3].tm, r4_w = R[3].w, r4_l = R[3].l, r4_pc = R[3].pc, r4_pt = R[3].pt, r4_bg = R[3].bg, r4_rc = R[3].rc;
export const r5_rk = R[4].rk, r5_tm = R[4].tm, r5_w = R[4].w, r5_l = R[4].l, r5_pc = R[4].pc, r5_pt = R[4].pt, r5_bg = R[4].bg, r5_rc = R[4].rc;
export const r6_rk = R[5].rk, r6_tm = R[5].tm, r6_w = R[5].w, r6_l = R[5].l, r6_pc = R[5].pc, r6_pt = R[5].pt, r6_bg = R[5].bg, r6_rc = R[5].rc;
export const r7_rk = R[6].rk, r7_tm = R[6].tm, r7_w = R[6].w, r7_l = R[6].l, r7_pc = R[6].pc, r7_pt = R[6].pt, r7_bg = R[6].bg, r7_rc = R[6].rc;
export const r8_rk = R[7].rk, r8_tm = R[7].tm, r8_w = R[7].w, r8_l = R[7].l, r8_pc = R[7].pc, r8_pt = R[7].pt, r8_bg = R[7].bg, r8_rc = R[7].rc;
export const r9_rk = R[8].rk, r9_tm = R[8].tm, r9_w = R[8].w, r9_l = R[8].l, r9_pc = R[8].pc, r9_pt = R[8].pt, r9_bg = R[8].bg, r9_rc = R[8].rc;
export const r10_rk = R[9].rk, r10_tm = R[9].tm, r10_w = R[9].w, r10_l = R[9].l, r10_pc = R[9].pc, r10_pt = R[9].pt, r10_bg = R[9].bg, r10_rc = R[9].rc;

// Cut lines sit in the gap under a rank; off-screen when that rank is not shown.
function lineY(rank) {
  return list.length >= rank && rank >= 1 && rank <= ROWS ? TOP + rank * ROW_H - 1 : -200;
}
export const direct_y = lineY(DIRECT);
export const finals_y = lineY(FINALS);
export const title = "AFL " + shownYear;
export const status = label.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 14);
export const right = starts || now("HH:mm");
export const foot = list.length ? "Top " + DIRECT + " to finals, " + (DIRECT + 1) + "-" + FINALS + " wildcard" : "";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 24, "#0A2440"],
  ["text", "{title}", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{status}", 142, 12, 2, 1, "MC", "#4FC3F7"],
  ["text", "{right}", 312, 12, 2, 1, "MR", "#D0D0D0"],
  ["text", "#", 18, 31, 1, 1, "MC", "#808080"],
  ["text", "TEAM", 34, 31, 1, 1, "ML", "#808080"],
  ["text", "W", 172, 31, 1, 1, "MR", "#808080"],
  ["text", "L", 204, 31, 1, 1, "MR", "#808080"],
  ["text", "%", 262, 31, 1, 1, "MR", "#808080"],
  ["text", "PTS", 312, 31, 1, 1, "MR", "#808080"],
  ...Array.from({ length: ROWS }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    const c = y + ROW_H / 2;
    return [
      ["fillRect", 0, y, 320, ROW_H, `{r${n}_bg}`],
      ["text", `{r${n}_rk}`, 24, c, 2, 1, "MR", `{r${n}_rc}`],
      ["text", `{r${n}_tm}`, 34, c, 2, 1, "ML", "#FFFFFF"],
      ["text", `{r${n}_w}`, 172, c, 2, 1, "MR", "#E0E0E0"],
      ["text", `{r${n}_l}`, 204, c, 2, 1, "MR", "#A0A0A0"],
      ["text", `{r${n}_pc}`, 262, c, 2, 1, "MR", "#A0A0A0"],
      ["text", `{r${n}_pt}`, 312, c, 2, 1, "MR", "#FFFFFF"],
    ];
  }).flat(),
  ["drawFastHLine", 8, "{direct_y}", 304, "#406080"],
  ["drawFastHLine", 8, "{finals_y}", 304, "#4FC3F7"],
  ["text", "{foot}", 8, 235, 1, 1, "ML", "#707070"],
  ["text", "squiggle.com.au", 312, 235, 1, 1, "MR", "#505050"],
];

const template: Template = {
  id: "afl-ladder",
  name: "AFL ladder",
  description: "The AFL top 10 with wins, losses, percentage and points, finals cut lines, and the next season's start date in the off-season.",
  apis: ["Squiggle"],
  category: "sports",
  dataCode: code,
  rows: rows("afl-ladder", wire),
  sampleVars: {"direct_y":151,"finals_y":227,"foot":"Top 6 to finals, 7-10 wildcard","r10_bg":"#10161E","r10_l":"10","r10_pc":"101.5","r10_pt":"50","r10_rc":"#C0C0C0","r10_rk":"10","r10_tm":"Carlton","r10_w":"12","r1_bg":"#000000","r1_l":"4","r1_pc":"137.2","r1_pt":"76","r1_rc":"#4FC3F7","r1_rk":"1","r1_tm":"Fremantle","r1_w":"19","r2_bg":"#10161E","r2_l":"5","r2_pc":"136.1","r2_pt":"72","r2_rc":"#4FC3F7","r2_rk":"2","r2_tm":"Sydney","r2_w":"18","r3_bg":"#000000","r3_l":"7","r3_pc":"121.7","r3_pt":"64","r3_rc":"#4FC3F7","r3_rk":"3","r3_tm":"Brisbane","r3_w":"16","r4_bg":"#10161E","r4_l":"6","r4_pc":"120.1","r4_pt":"64","r4_rc":"#4FC3F7","r4_rk":"4","r4_tm":"Hawthorn","r4_w":"15","r5_bg":"#000000","r5_l":"8","r5_pc":"122.3","r5_pt":"60","r5_rc":"#4FC3F7","r5_rk":"5","r5_tm":"Geelong","r5_w":"15","r6_bg":"#10161E","r6_l":"8","r6_pc":"117.3","r6_pt":"60","r6_rc":"#4FC3F7","r6_rk":"6","r6_tm":"Adelaide","r6_w":"15","r7_bg":"#000000","r7_l":"8","r7_pc":"109.6","r7_pt":"60","r7_rc":"#C0C0C0","r7_rk":"7","r7_tm":"Melbourne","r7_w":"15","r8_bg":"#10161E","r8_l":"9","r8_pc":"95.4","r8_pt":"54","r8_rc":"#C0C0C0","r8_rk":"8","r8_tm":"Bulldogs","r8_w":"13","r9_bg":"#000000","r9_l":"9","r9_pc":"102.4","r9_pt":"52","r9_rc":"#C0C0C0","r9_rk":"9","r9_tm":"Collingwood","r9_w":"12","right":"Starts 17 Mar","status":"Final ladder","title":"AFL 2026"},
};

export default template;
