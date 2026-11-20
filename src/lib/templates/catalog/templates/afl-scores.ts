import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// AFL scoreboard: 5 games around "now" (recent results, live games, next fixtures)

const TOP = 28; // y of the first game row
const ROW_H = 42; // 5 rows fill 28..238

const code = String.raw`// AFL scores from Squiggle (api.squiggle.com.au, free, no key; it asks for a User-Agent,
// which the sandbox sends). Shows up to 3 recent results, then live games and the next fixtures.
// In the off-season it shows the end of last season (the finals), switching to the new
// season's first fixtures LEAD_DAYS before round 1.
const GAMES = 5; // rows on screen
const LEAD_DAYS = 21; // pre-season: start showing the new fixture this many days before round 1
const WIN = "#FFFFFF", LOSE = "#8A8A8A", LIVE = "#FFC400", DONE = "#B0B0B0", NEXT = "#4FC3F7";

const ABBR = {
  "Adelaide": "ADE", "Brisbane Lions": "BRI", "Carlton": "CAR", "Collingwood": "COL",
  "Essendon": "ESS", "Fremantle": "FRE", "Geelong": "GEE", "Gold Coast": "GCS",
  "Greater Western Sydney": "GWS", "Hawthorn": "HAW", "Melbourne": "MEL",
  "North Melbourne": "NTH", "Port Adelaide": "PTA", "Richmond": "RIC", "St Kilda": "STK",
  "Sydney": "SYD", "West Coast": "WCE", "Western Bulldogs": "WBD",
};
function abbr(name) {
  if (!name) return "TBA";
  return ABBR[name] || String(name).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

async function season(year) {
  try {
    const d = await get("https://api.squiggle.com.au/?q=games;year=" + year, { cache: 120 });
    const g = d && Array.isArray(d.games) ? d.games : [];
    return g.filter((x) => typeof x.unixtime === "number").sort((a, b) => a.unixtime - b.unixtime || a.id - b.id);
  } catch (e) {
    console.log("afl-scores: " + e.message);
    return null;
  }
}

const nowSec = Math.floor(Date.now() / 1000);
const year = Number(now("YYYY"));
let games = await season(year);
let failed = games === null;
if (games) {
  const started = games.some((g) => g.complete > 0);
  const first = games[0];
  if (!started && (!first || first.unixtime - nowSec > LEAD_DAYS * 86400)) {
    const prev = await season(year - 1);
    if (prev && prev.length) games = prev;
  }
}
games = games || [];

// Pick the window: up to 3 games before the first unfinished one, then the rest.
let firstOpen = games.findIndex((g) => !(g.complete >= 100));
if (firstOpen < 0) firstOpen = games.length;
let start = Math.max(0, firstOpen - 3);
if (start + GAMES > games.length) start = Math.max(0, games.length - GAMES);
const shown = games.slice(start, start + GAMES);

// Owner's UTC offset, from now() vs the real clock, to show kick-off times in local time.
const m = now("YYYY MM DD HH mm").split(" ").map(Number);
const offMin = Math.round((Date.UTC(m[0], m[1] - 1, m[2], m[3], m[4]) / 1000 - nowSec) / 900) * 15;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad(n) { return (n < 10 ? "0" : "") + n; }
function kickoff(unix) {
  const d = new Date((unix + offMin * 60) * 1000);
  if (unix - nowSec > 6 * 86400) return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  return DAYS[d.getUTCDay()] + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}
function venue(v) {
  return String(v || "").replace(/[^A-Za-z0-9 ]/g, "").replace(/^(.{1,10})( .*)?$/, "$1").slice(0, 10);
}
function gb(g, b) {
  return typeof g === "number" && typeof b === "number" ? g + "." + b : "";
}

function row(i) {
  const g = shown[i];
  if (!g) {
    return { h: i === 0 ? (failed ? "No data" : "No games") : "", a: "", hs: "", as: "", hgb: "", agb: "",
      st: "", sub: "", hc: LOSE, ac: LOSE, sc: DONE };
  }
  const r = { h: abbr(g.hteam), a: abbr(g.ateam), hs: "", as: "", hgb: "", agb: "", st: "", sub: venue(g.venue),
    hc: WIN, ac: WIN, sc: DONE };
  if (g.complete > 0) {
    r.hs = String(g.hscore || 0);
    r.as = String(g.ascore || 0);
    r.hgb = gb(g.hgoals, g.hbehinds);
    r.agb = gb(g.agoals, g.abehinds);
    if (g.complete >= 100) {
      r.st = "FT";
      if (g.hscore > g.ascore) r.ac = LOSE;
      else if (g.ascore > g.hscore) r.hc = LOSE;
    } else {
      const t = String(g.timestr || "").replace(/[^A-Za-z0-9:\/ ]/g, "").trim();
      r.st = (t && t.length <= 9 ? t : g.complete + "%");
      r.sc = LIVE;
    }
  } else {
    r.st = kickoff(g.unixtime);
    r.sc = NEXT;
  }
  return r;
}
const R = [0, 1, 2, 3, 4].map(row);
export const g1_h = R[0].h, g1_a = R[0].a, g1_hs = R[0].hs, g1_as = R[0].as, g1_hgb = R[0].hgb, g1_agb = R[0].agb, g1_st = R[0].st, g1_sub = R[0].sub, g1_hc = R[0].hc, g1_ac = R[0].ac, g1_sc = R[0].sc;
export const g2_h = R[1].h, g2_a = R[1].a, g2_hs = R[1].hs, g2_as = R[1].as, g2_hgb = R[1].hgb, g2_agb = R[1].agb, g2_st = R[1].st, g2_sub = R[1].sub, g2_hc = R[1].hc, g2_ac = R[1].ac, g2_sc = R[1].sc;
export const g3_h = R[2].h, g3_a = R[2].a, g3_hs = R[2].hs, g3_as = R[2].as, g3_hgb = R[2].hgb, g3_agb = R[2].agb, g3_st = R[2].st, g3_sub = R[2].sub, g3_hc = R[2].hc, g3_ac = R[2].ac, g3_sc = R[2].sc;
export const g4_h = R[3].h, g4_a = R[3].a, g4_hs = R[3].hs, g4_as = R[3].as, g4_hgb = R[3].hgb, g4_agb = R[3].agb, g4_st = R[3].st, g4_sub = R[3].sub, g4_hc = R[3].hc, g4_ac = R[3].ac, g4_sc = R[3].sc;
export const g5_h = R[4].h, g5_a = R[4].a, g5_hs = R[4].hs, g5_as = R[4].as, g5_hgb = R[4].hgb, g5_agb = R[4].agb, g5_st = R[4].st, g5_sub = R[4].sub, g5_hc = R[4].hc, g5_ac = R[4].ac, g5_sc = R[4].sc;

// Header: the round of the latest game on screen that has started (or the first fixture).
let label = "";
for (const g of shown) if (g.complete > 0) label = g.roundname || ("Round " + g.round);
if (!label && shown[0]) label = shown[0].roundname || ("Round " + shown[0].round);
const yr = shown.length ? shown[shown.length - 1].year : year;
export const title = "AFL " + yr;
export const round = String(label).replace(/[^A-Za-z0-9 ]/g, "").replace("Preliminary", "Prelim").slice(0, 16);
export const clock = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#0A2440"],
  ["text", "{title}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{round}", 160, 13, 2, 1, "MC", "#4FC3F7"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#D0D0D0"],
  ...[0, 1, 2, 3, 4].flatMap((i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    const l1 = y + 13; // team / total line
    const l2 = y + 34; // goals.behinds / venue line
    return [
      ...(i % 2 === 1 ? ([["fillRect", 0, y, 320, ROW_H, "#121820"]] as RawWireOp[]) : []),
      ["text", `{g${n}_h}`, 8, l1, 4, 1, "ML", `{g${n}_hc}`],
      ["text", `{g${n}_hs}`, 118, l1, 4, 1, "MR", `{g${n}_hc}`],
      ["text", `{g${n}_st}`, 160, l1, 2, 1, "MC", `{g${n}_sc}`],
      ["text", `{g${n}_as}`, 202, l1, 4, 1, "ML", `{g${n}_ac}`],
      ["text", `{g${n}_a}`, 312, l1, 4, 1, "MR", `{g${n}_ac}`],
      ["text", `{g${n}_hgb}`, 118, l2, 2, 1, "MR", "#9A9A9A"],
      ["text", `{g${n}_sub}`, 160, l2, 1, 1, "MC", "#707070"],
      ["text", `{g${n}_agb}`, 202, l2, 2, 1, "ML", "#9A9A9A"],
    ];
  }),
];

const template: Template = {
  id: "afl-scores",
  name: "AFL scores",
  description: "Five AFL games with goals.behinds and totals: recent results, live quarter and clock, and upcoming kick-off times.",
  apis: ["Squiggle"],
  category: "sports",
  dataCode: code,
  rows: rows("afl-scores", wire),
  sampleVars: {"clock":"14:30","g1_a":"GEE","g1_ac":"#8A8A8A","g1_agb":"16.10","g1_as":"106","g1_h":"FRE","g1_hc":"#FFFFFF","g1_hgb":"18.12","g1_hs":"120","g1_sc":"#B0B0B0","g1_st":"FT","g1_sub":"Perth","g2_a":"ADE","g2_ac":"#8A8A8A","g2_agb":"13.13","g2_as":"91","g2_h":"BRI","g2_hc":"#FFFFFF","g2_hgb":"21.18","g2_hs":"144","g2_sc":"#B0B0B0","g2_st":"FT","g2_sub":"Gabba","g3_a":"FRE","g3_ac":"#FFFFFF","g3_agb":"12.11","g3_as":"83","g3_h":"SYD","g3_hc":"#8A8A8A","g3_hgb":"10.11","g3_hs":"71","g3_sc":"#B0B0B0","g3_st":"FT","g3_sub":"SCG","g4_a":"BRI","g4_ac":"#FFFFFF","g4_agb":"20.11","g4_as":"131","g4_h":"HAW","g4_hc":"#8A8A8A","g4_hgb":"19.8","g4_hs":"122","g4_sc":"#B0B0B0","g4_st":"FT","g4_sub":"MCG","g5_a":"BRI","g5_ac":"#FFFFFF","g5_agb":"14.12","g5_as":"96","g5_h":"FRE","g5_hc":"#8A8A8A","g5_hgb":"12.17","g5_hs":"89","g5_sc":"#B0B0B0","g5_st":"FT","g5_sub":"MCG","round":"Grand Final","title":"AFL 2026"},
};

export default template;
