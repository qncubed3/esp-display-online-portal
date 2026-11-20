import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Formula 1 drivers' championship: the top 8 as team-coloured bars proportional to points (Jolpica)

const code = String.raw`// The top 8 of the Formula 1 drivers' championship as horizontal bars, sized by points
// and coloured by team, from Jolpica (the keyless Ergast replacement, 500 requests/hour).
// Before the first race of a season, the previous season's final table is shown.
const CACHE_S = 3600;
const BASE = "https://api.jolpi.ca/ergast/f1/";

// Team colours by Jolpica constructorId. Unknown teams fall back to grey.
const TEAM = {
  mercedes: "#27F4D2", ferrari: "#E8002D", red_bull: "#3671C6", mclaren: "#FF8000",
  rb: "#6692FF", alpine: "#FF87BC", haas: "#B6BABD", audi: "#D7D2CB",
  sauber: "#52E252", williams: "#64C4FF", aston_martin: "#229971", cadillac: "#D4AF37",
};
const OTHER = "#8C97AB";

// The fonts are ASCII only.
function ascii(s) {
  return String(s || "").normalize("NFD").replace(/[^\x20-\x7E]/g, "").trim();
}

async function load(path) {
  try {
    return await get(BASE + path, { cache: CACHE_S });
  } catch (e) {
    console.log("jolpica fetch failed:", path, e.message);
    return null;
  }
}
function standingsOf(res) {
  const lists = res && res.MRData && res.MRData.StandingsTable && res.MRData.StandingsTable.StandingsLists;
  return lists && lists[0] ? lists[0] : null;
}

const res = await load("current/driverStandings.json");
let table = standingsOf(res);
let final = false;
if (!table && res && res.MRData && res.MRData.StandingsTable) {
  const season = Number(res.MRData.StandingsTable.season) || 0;
  if (season) {
    table = standingsOf(await load((season - 1) + "/driverStandings.json"));
    final = true;
  }
}

const list = table ? (table.DriverStandings || []).slice(0, 8) : [];
export const title = table ? "F1 DRIVERS " + table.season : "F1 DRIVERS";
export const sub = !table ? "NO DATA" : final ? "FINAL" : "AFTER ROUND " + table.round;

// Rows: position, team stripe, driver code, bar (max BAR_W px for the leader) and points.
const BAR_X = 72, BAR_W = 196, ROW0 = 42, STEP = 24, HIDE = -200;
const lead = list[0] ? Number(list[0].points) || 1 : 1;
const out = {};
for (let i = 0; i < 8; i++) {
  const s = list[i];
  const n = i + 1;
  const y = ROW0 + i * STEP;
  if (!s) {
    out["r" + n + "_pos"] = ""; out["r" + n + "_code"] = ""; out["r" + n + "_pts"] = "";
    out["r" + n + "_bw"] = 0; out["r" + n + "_by"] = HIDE; out["r" + n + "_col"] = OTHER;
    continue;
  }
  const drv = s.Driver || {};
  const team = s.Constructors && s.Constructors[0] ? s.Constructors[0].constructorId : "";
  const pts = Number(s.points) || 0;
  out["r" + n + "_pos"] = String(s.positionText || s.position || n);
  out["r" + n + "_code"] = ascii(drv.code || String(drv.familyName || "").slice(0, 3).toUpperCase());
  out["r" + n + "_pts"] = String(s.points);
  out["r" + n + "_bw"] = Math.max(2, Math.round((BAR_W * pts) / lead));
  out["r" + n + "_by"] = y - 6;
  out["r" + n + "_col"] = TEAM[team] || OTHER;
}
export const r1_pos = out.r1_pos, r1_code = out.r1_code, r1_pts = out.r1_pts, r1_bw = out.r1_bw, r1_by = out.r1_by, r1_col = out.r1_col;
export const r2_pos = out.r2_pos, r2_code = out.r2_code, r2_pts = out.r2_pts, r2_bw = out.r2_bw, r2_by = out.r2_by, r2_col = out.r2_col;
export const r3_pos = out.r3_pos, r3_code = out.r3_code, r3_pts = out.r3_pts, r3_bw = out.r3_bw, r3_by = out.r3_by, r3_col = out.r3_col;
export const r4_pos = out.r4_pos, r4_code = out.r4_code, r4_pts = out.r4_pts, r4_bw = out.r4_bw, r4_by = out.r4_by, r4_col = out.r4_col;
export const r5_pos = out.r5_pos, r5_code = out.r5_code, r5_pts = out.r5_pts, r5_bw = out.r5_bw, r5_by = out.r5_by, r5_col = out.r5_col;
export const r6_pos = out.r6_pos, r6_code = out.r6_code, r6_pts = out.r6_pts, r6_bw = out.r6_bw, r6_by = out.r6_by, r6_col = out.r6_col;
export const r7_pos = out.r7_pos, r7_code = out.r7_code, r7_pts = out.r7_pts, r7_bw = out.r7_bw, r7_by = out.r7_by, r7_col = out.r7_col;
export const r8_pos = out.r8_pos, r8_code = out.r8_code, r8_pts = out.r8_pts, r8_bw = out.r8_bw, r8_by = out.r8_by, r8_col = out.r8_col;

// Footer: the leader's margin over P2 and their win count.
let foot = "Jolpica F1 unavailable";
if (list.length >= 2) {
  const gap = (Number(list[0].points) || 0) - (Number(list[1].points) || 0);
  const wins = Number(list[0].wins) || 0;
  foot = out.r1_code + (final ? " won by " : " leads by ") + gap + " pts  -  " + wins + (wins === 1 ? " win" : " wins");
} else if (list.length === 1) {
  foot = "";
}
export { foot };
export const clock = now("HH:mm");
`;

const rowOps: RawWireOp[] = Array.from({ length: 8 }, (_, i) => i + 1).flatMap((n): RawWireOp[] => {
  const y = 42 + (n - 1) * 24;
  return [
    ["text", `{r${n}_pos}`, 22, y, 2, 1, "MR", "#8C97AB"],
    ["fillRect", 28, `{r${n}_by}`, 3, 13, `{r${n}_col}`],
    ["text", `{r${n}_code}`, 36, y, 2, 1, "ML", "#FFFFFF"],
    ["fillRect", 72, `{r${n}_by}`, 196, 13, "#161A22"],
    ["fillRect", 72, `{r${n}_by}`, `{r${n}_bw}`, 13, `{r${n}_col}`],
    ["text", `{r${n}_pts}`, 312, y, 2, 1, "MR", "#FFFFFF"],
  ];
});

const wire: RawWireOp[] = [
  ["fillScreen", "#07080C"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A0A0C"],
  ["fillRect", 0, 24, 320, 2, "#E10600"],
  ["text", "{title}", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{sub}", 250, 12, 1, 1, "MR", "#FF4A3D"],
  ["text", "{clock}", 312, 12, 2, 1, "MR", "#A8B3C7"],
  // Standings
  ...rowOps,
  // Footer
  ["text", "{foot}", 8, 231, 1, 1, "ML", "#8C97AB"],
];

const template: Template = {
  id: "f1-standings",
  name: "F1 driver standings",
  description: "The top 8 of the Formula 1 drivers' championship as team-coloured bars sized by points.",
  apis: ["Jolpica F1"],
  category: "sports",
  dataCode: code,
  rows: rows("f1-standings", wire),
  sampleVars: {"clock":"01:22","foot":"ANT leads by 111 pts  -  9 wins","r1_bw":196,"r1_by":36,"r1_code":"ANT","r1_col":"#27F4D2","r1_pos":"1","r1_pts":"390","r2_bw":140,"r2_by":60,"r2_code":"VER","r2_col":"#3671C6","r2_pos":"2","r2_pts":"279","r3_bw":132,"r3_by":84,"r3_code":"RUS","r3_col":"#27F4D2","r3_pos":"3","r3_pts":"262","r4_bw":131,"r4_by":108,"r4_code":"HAM","r4_col":"#E8002D","r4_pos":"4","r4_pts":"261","r5_bw":125,"r5_by":132,"r5_code":"LEC","r5_col":"#E8002D","r5_pos":"5","r5_pts":"249","r6_bw":124,"r6_by":156,"r6_code":"NOR","r6_col":"#FF8000","r6_pos":"6","r6_pts":"246","r7_bw":76,"r7_by":180,"r7_code":"PIA","r7_col":"#FF8000","r7_pos":"7","r7_pts":"152","r8_bw":61,"r8_by":204,"r8_code":"HAD","r8_col":"#3671C6","r8_pos":"8","r8_pts":"122","sub":"AFTER ROUND 20","title":"F1 DRIVERS 2026"},
};

export default template;
