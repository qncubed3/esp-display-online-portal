import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Premier League table: 10 rows (top half by default) with played, W/D/L, goal difference and points.

const TOP = 38; // y of the first table row (also in the Data code)
const ROW_H = 20; // 10 rows fill 38..238 (also in the Data code)
const N = 10;

const code = String.raw`// English Premier League table from ESPN's public standings (site.api.espn.com, free, no key).
// A coloured bar marks the qualification and relegation zones.
const FIRST = 1; // first position shown: 1 = top ten, 11 = bottom ten
const MY_TEAM = ""; // team abbreviation to highlight, e.g. "LIV"
const ROWS = 10;
const OFF = -200; // y that hides a shape
const TOP = 38, ROW_H = 20; // table rows on screen (match Draw)
const STRIPE = "#141414", MINE = "#22304A";

function ascii(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[^ -~]/g, "").trim();
}
function num(e, name) {
  const s = (e.stats || []).find((x) => x.name === name);
  return s && isFinite(Number(s.value)) ? Number(s.value) : 0;
}
// Zone colour from ESPN's note (its colours are pale pastels, sometimes "##RRGGBB").
function zone(note) {
  if (!note) return "";
  const d = String(note.description || "").toLowerCase();
  if (d.indexOf("champions") >= 0) return "#00C853";
  if (d.indexOf("europa") >= 0) return "#FFA726";
  if (d.indexOf("conference") >= 0) return "#26C6DA";
  if (d.indexOf("releg") >= 0) return "#FF3D3D";
  const c = String(note.color || "").replace(/^#+/, "");
  return /^[0-9A-Fa-f]{6}$/.test(c) ? "#" + c.toUpperCase() : "";
}

let data = null;
try {
  data = await get("https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings", { cache: 1800 });
} catch (e) {
  console.log("epl-table: " + e.message);
}
const st = data && ((data.children && data.children[0] && data.children[0].standings) || data.standings);
let entries = st && Array.isArray(st.entries) ? st.entries.slice() : [];
entries.sort((a, b) => (num(a, "rank") || 99) - (num(b, "rank") || 99));

const start = Math.max(0, Math.min(Math.max(entries.length - ROWS, 0), Math.floor(FIRST) - 1));
const shown = entries.slice(start, start + ROWS);
const mine = String(MY_TEAM || "").trim().toUpperCase();

const R = [];
for (let i = 0; i < ROWS; i++) {
  const e = shown[i];
  const r = { pos: "", team: "", p: "", w: "", d: "", l: "", gd: "", pts: "", zc: "#000000", zy: OFF, by: OFF, bg: STRIPE };
  if (e) {
    const t = e.team || {};
    const abbr = ascii(t.abbreviation).toUpperCase();
    r.pos = String(num(e, "rank") || start + i + 1);
    r.team = ascii(t.shortDisplayName || t.displayName || t.name || abbr).slice(0, 14);
    r.p = String(num(e, "gamesPlayed"));
    r.w = String(num(e, "wins"));
    r.d = String(num(e, "ties"));
    r.l = String(num(e, "losses"));
    const gd = num(e, "pointDifferential");
    r.gd = gd > 0 ? "+" + gd : String(gd);
    r.pts = String(num(e, "points"));
    const z = zone(e.note);
    if (z) { r.zc = z; r.zy = TOP + i * ROW_H + 2; }
    if (mine && abbr === mine) { r.bg = MINE; r.by = TOP + i * ROW_H; }
    else if (i % 2 === 1) r.by = TOP + i * ROW_H;
  }
  R.push(r);
}
`;

// Flat exports r1_pos .. r10_bg, generated so the list stays in step with N.
const dataCode = code
  + Array.from({ length: N }, (_, i) => {
    const n = i + 1;
    return ["pos", "team", "p", "w", "d", "l", "gd", "pts", "zc", "zy", "by", "bg"]
      .map((k) => "export const r" + n + "_" + k + " = R[" + i + "]." + k + ";")
      .join("\n");
  }).join("\n") + String.raw`

// Header: matchweek (most games played) and the update time.
let week = 0;
for (const e of entries) week = Math.max(week, num(e, "gamesPlayed"));
export const week_label = entries.length ? "Week " + week : "";
export const time = now("HH:mm");
export const empty = entries.length ? "" : (data ? "No table yet" : "No data");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 24, "#3D195B"],
  ["text", "Premier League", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{week_label}", 262, 12, 2, 1, "MR", "#00FF85"],
  ["text", "{time}", 312, 12, 2, 1, "MR", "#D0D0D0"],
  ["text", "#", 28, 31, 1, 1, "MR", "#808080"],
  ["text", "Team", 36, 31, 1, 1, "ML", "#808080"],
  ["text", "P", 166, 31, 1, 1, "MC", "#808080"],
  ["text", "W", 190, 31, 1, 1, "MC", "#808080"],
  ["text", "D", 212, 31, 1, 1, "MC", "#808080"],
  ["text", "L", 234, 31, 1, 1, "MC", "#808080"],
  ["text", "GD", 272, 31, 1, 1, "MR", "#808080"],
  ["text", "Pts", 312, 31, 1, 1, "MR", "#808080"],
  ...Array.from({ length: N }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const cy = TOP + i * ROW_H + ROW_H / 2;
    return [
      ["fillRect", 0, `{r${n}_by}`, 320, ROW_H, `{r${n}_bg}`],
      ["fillRect", 4, `{r${n}_zy}`, 4, ROW_H - 4, `{r${n}_zc}`],
      ["text", `{r${n}_pos}`, 28, cy, 2, 1, "MR", "#B0B0B0"],
      ["text", `{r${n}_team}`, 36, cy, 2, 1, "ML", "#FFFFFF"],
      ["text", `{r${n}_p}`, 166, cy, 2, 1, "MC", "#B0B0B0"],
      ["text", `{r${n}_w}`, 190, cy, 2, 1, "MC", "#B0B0B0"],
      ["text", `{r${n}_d}`, 212, cy, 2, 1, "MC", "#B0B0B0"],
      ["text", `{r${n}_l}`, 234, cy, 2, 1, "MC", "#B0B0B0"],
      ["text", `{r${n}_gd}`, 272, cy, 2, 1, "MR", "#B0B0B0"],
      ["text", `{r${n}_pts}`, 312, cy, 2, 1, "MR", "#00FF85"],
    ];
  }).flat(),
  ["text", "{empty}", 160, 130, 4, 1, "MC", "#FFFFFF"],
];

const template: Template = {
  id: "epl-table",
  name: "Premier League table",
  description: "The Premier League top ten (or bottom ten): played, W/D/L, goal difference and points, with Champions League and relegation zones marked.",
  apis: ["ESPN"],
  category: "sports",
  dataCode,
  rows: rows("epl-table", wire),
  sampleVars: {"empty":"","r10_bg":"#141414","r10_by":218,"r10_d":"4","r10_gd":"-3","r10_l":"3","r10_p":"10","r10_pos":"10","r10_pts":"13","r10_team":"Aston Villa","r10_w":"3","r10_zc":"#000000","r10_zy":-200,"r1_bg":"#141414","r1_by":-200,"r1_d":"0","r1_gd":"+10","r1_l":"1","r1_p":"10","r1_pos":"1","r1_pts":"27","r1_team":"Arsenal","r1_w":"9","r1_zc":"#00C853","r1_zy":40,"r2_bg":"#141414","r2_by":58,"r2_d":"1","r2_gd":"+19","r2_l":"2","r2_p":"10","r2_pos":"2","r2_pts":"22","r2_team":"Brighton","r2_w":"7","r2_zc":"#00C853","r2_zy":60,"r3_bg":"#141414","r3_by":-200,"r3_d":"0","r3_gd":"+8","r3_l":"3","r3_p":"10","r3_pos":"3","r3_pts":"21","r3_team":"Man City","r3_w":"7","r3_zc":"#00C853","r3_zy":80,"r4_bg":"#141414","r4_by":98,"r4_d":"3","r4_gd":"+4","r4_l":"2","r4_p":"10","r4_pos":"4","r4_pts":"18","r4_team":"Liverpool","r4_w":"5","r4_zc":"#00C853","r4_zy":100,"r5_bg":"#141414","r5_by":-200,"r5_d":"1","r5_gd":"+3","r5_l":"4","r5_p":"10","r5_pos":"5","r5_pts":"16","r5_team":"Chelsea","r5_w":"5","r5_zc":"#FFA726","r5_zy":120,"r6_bg":"#141414","r6_by":138,"r6_d":"4","r6_gd":"+2","r6_l":"2","r6_p":"10","r6_pos":"6","r6_pts":"16","r6_team":"Everton","r6_w":"4","r6_zc":"#000000","r6_zy":-200,"r7_bg":"#141414","r7_by":-200,"r7_d":"3","r7_gd":"+2","r7_l":"3","r7_p":"10","r7_pos":"7","r7_pts":"15","r7_team":"Bournemouth","r7_w":"4","r7_zc":"#000000","r7_zy":-200,"r8_bg":"#141414","r8_by":178,"r8_d":"5","r8_gd":"+5","r8_l":"2","r8_p":"10","r8_pos":"8","r8_pts":"14","r8_team":"Brentford","r8_w":"3","r8_zc":"#000000","r8_zy":-200,"r9_bg":"#141414","r9_by":-200,"r9_d":"5","r9_gd":"+2","r9_l":"2","r9_p":"10","r9_pos":"9","r9_pts":"14","r9_team":"Leeds","r9_w":"3","r9_zc":"#000000","r9_zy":-200,"time":"01:22","week_label":"Week 10"},
};

export default template;
