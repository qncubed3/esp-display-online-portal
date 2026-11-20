import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// NBA scoreboard: up to 5 of today's games (US game day) with scores, live clock or tip-off time.

const TOP = 28; // y of the first game row
const ROW_H = 42; // 5 rows fill 28..238

const code = String.raw`// Today's NBA games from ESPN's public scoreboard (site.api.espn.com, free, no key).
// "Today" is ESPN's current US game day. Tip-off times are shown in your local time.
// Live games get a red dot and sort first when there are more games than rows.
const GAMES = 5; // rows on screen
const WIN = "#FFFFFF", LOSE = "#8A8A8A", LIVE = "#FF5252", DONE = "#B0B0B0", NEXT = "#FFA726";
const OFF = -200; // y that hides the live dot

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad(n) { return (n < 10 ? "0" : "") + n; }
function ascii(s) { return String(s || "").replace(/[^A-Za-z0-9 .'-]/g, "").trim(); }
function dayLabel(ymd) {
  const p = String(ymd || "").slice(0, 10).split("-").map(Number);
  if (p.length < 3 || !p[0]) return "";
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
}

let data = null;
try {
  data = await get("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", { cache: 60 });
} catch (e) {
  console.log("nba-scores: " + e.message);
}
const events = data && Array.isArray(data.events) ? data.events : [];
const day = (data && data.day && data.day.date) || (events[0] ? new Date(Date.parse(events[0].date) - 5 * 3600000).toISOString().slice(0, 10) : "");

// Owner's UTC offset, from now() vs the real clock, to show tip-off times in local time.
const nowSec = Math.floor(Date.now() / 1000);
const m = now("YYYY MM DD HH mm").split(" ").map(Number);
const offMin = Math.round((Date.UTC(m[0], m[1] - 1, m[2], m[3], m[4]) / 1000 - nowSec) / 900) * 15;
function tipoff(iso) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return "TBD";
  const d = new Date(t + offMin * 60000);
  return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}
function abbr(team) {
  const a = ascii(team && team.abbreviation).toUpperCase();
  return a === "UTAH" ? "UTA" : a.slice(0, 3) || "TBA";
}
function nick(team) {
  return ascii(team && (team.shortDisplayName || team.name)).slice(0, 13);
}
function status(st) {
  const t = (st && st.type) || {};
  const name = t.name || "";
  if (t.state === "in") {
    if (name === "STATUS_HALFTIME") return "Half";
    const p = st.period || 0;
    const per = p > 4 ? (p === 5 ? "OT" : (p - 4) + "OT") : "Q" + p;
    if (name === "STATUS_END_PERIOD") return "End " + per;
    return per + " " + String(st.displayClock || "").replace(/\.\d+$/, "");
  }
  if (t.state === "post") {
    if (name === "STATUS_POSTPONED") return "PPD";
    if (name === "STATUS_CANCELED") return "Canc";
    return ascii(t.shortDetail || "Final").replace(/ /g, "").slice(0, 8) || "Final";
  }
  return null;
}

const rank = { in: 0, pre: 1, post: 2 };
let games = events.map((e, i) => ({ e, i, s: ((e.status || {}).type || {}).state || "pre" }));
if (games.length > GAMES) {
  games = games.slice().sort((a, b) => (rank[a.s] - rank[b.s]) || a.i - b.i).slice(0, GAMES);
  games.sort((a, b) => a.i - b.i);
}

function row(i) {
  const g = games[i];
  const r = { a: "", h: "", as: "", hs: "", an: "", hn: "", st: "", ac: WIN, hc: WIN, sc: DONE, dot: OFF };
  if (!g) return r;
  const comp = (g.e.competitions || [])[0] || {};
  const teams = comp.competitors || [];
  const home = teams.find((t) => t.homeAway === "home") || teams[0] || {};
  const away = teams.find((t) => t.homeAway === "away") || teams[1] || {};
  r.a = abbr(away.team);
  r.h = abbr(home.team);
  r.an = nick(away.team);
  r.hn = nick(home.team);
  const s = status(g.e.status || comp.status);
  if (s === null) {
    r.st = tipoff(g.e.date);
    r.sc = NEXT;
    return r;
  }
  r.st = s;
  if (s !== "PPD" && s !== "Canc") {
    r.as = String(away.score == null ? "" : away.score);
    r.hs = String(home.score == null ? "" : home.score);
  }
  if (g.s === "in") {
    r.sc = LIVE;
    r.dot = 44 + i * 42; // row centre (rows start at y 28, 42 px each)
  } else if (r.as !== "" && r.hs !== "") {
    const av = Number(r.as), hv = Number(r.hs);
    if (av > hv) r.hc = LOSE;
    else if (hv > av) r.ac = LOSE;
  }
  return r;
}
const R = [0, 1, 2, 3, 4].map(row);
export const g1_a = R[0].a, g1_h = R[0].h, g1_as = R[0].as, g1_hs = R[0].hs, g1_an = R[0].an, g1_hn = R[0].hn, g1_st = R[0].st, g1_ac = R[0].ac, g1_hc = R[0].hc, g1_sc = R[0].sc, g1_dot = R[0].dot;
export const g2_a = R[1].a, g2_h = R[1].h, g2_as = R[1].as, g2_hs = R[1].hs, g2_an = R[1].an, g2_hn = R[1].hn, g2_st = R[1].st, g2_ac = R[1].ac, g2_hc = R[1].hc, g2_sc = R[1].sc, g2_dot = R[1].dot;
export const g3_a = R[2].a, g3_h = R[2].h, g3_as = R[2].as, g3_hs = R[2].hs, g3_an = R[2].an, g3_hn = R[2].hn, g3_st = R[2].st, g3_ac = R[2].ac, g3_hc = R[2].hc, g3_sc = R[2].sc, g3_dot = R[2].dot;
export const g4_a = R[3].a, g4_h = R[3].h, g4_as = R[3].as, g4_hs = R[3].hs, g4_an = R[3].an, g4_hn = R[3].hn, g4_st = R[3].st, g4_ac = R[3].ac, g4_hc = R[3].hc, g4_sc = R[3].sc, g4_dot = R[3].dot;
export const g5_a = R[4].a, g5_h = R[4].h, g5_as = R[4].as, g5_hs = R[4].hs, g5_an = R[4].an, g5_hn = R[4].hn, g5_st = R[4].st, g5_ac = R[4].ac, g5_hc = R[4].hc, g5_sc = R[4].sc, g5_dot = R[4].dot;

// Stripe behind rows 2 and 4, hidden when the row is empty.
export const g2_by = R[1].a ? 70 : OFF, g4_by = R[3].a ? 154 : OFF;

// Header and the empty-day message.
export const date = dayLabel(day) || now("ddd DD/MM");
export const count = !events.length ? "" : (events.length === 1 ? "1 game" : events.length + " games");
let next = "";
if (data && !events.length) {
  const cal = (((data.leagues || [])[0] || {}).calendar || []).map((c) => String(c && c.startDate || c).slice(0, 10));
  const after = cal.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c) && c > day).sort()[0];
  if (after) next = "Next games: " + dayLabel(after);
}
export const empty = !data ? "No data" : (events.length ? "" : "No games today");
export const empty2 = next;
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#3A1A08"],
  ["text", "NBA", 8, 13, 2, 1, "ML", "#FFA726"],
  ["text", "{date}", 44, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{count}", 312, 13, 2, 1, "MR", "#D0D0D0"],
  ...[0, 1, 2, 3, 4].flatMap((i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    const l1 = y + 16; // abbreviation / score line
    const l2 = y + 35; // team nickname line
    return [
      ...(i % 2 === 1 ? ([["fillRect", 0, `{g${n}_by}`, 320, ROW_H, "#141414"]] as RawWireOp[]) : []),
      ["fillCircle", 11, `{g${n}_dot}`, 4, "#FF1744"],
      ["text", `{g${n}_a}`, 22, l1, 4, 1, "ML", `{g${n}_ac}`],
      ["text", `{g${n}_as}`, 124, l1, 4, 1, "MR", `{g${n}_ac}`],
      ["text", `{g${n}_st}`, 160, l1, 2, 1, "MC", `{g${n}_sc}`],
      ["text", `{g${n}_hs}`, 196, l1, 4, 1, "ML", `{g${n}_hc}`],
      ["text", `{g${n}_h}`, 312, l1, 4, 1, "MR", `{g${n}_hc}`],
      ["text", `{g${n}_an}`, 22, l2, 1, 1, "ML", "#808080"],
      ["text", `{g${n}_hn}`, 312, l2, 1, 1, "MR", "#808080"],
    ];
  }),
  ["text", "{empty}", 160, 110, 4, 1, "MC", "#FFFFFF"],
  ["text", "{empty2}", 160, 145, 2, 1, "MC", "#FFA726"],
];

const template: Template = {
  id: "nba-scores",
  name: "NBA scores",
  description: "Today's NBA games: away and home scores, live quarter and clock with a red LIVE dot, finals and local tip-off times.",
  apis: ["ESPN"],
  category: "sports",
  dataCode: code,
  rows: rows("nba-scores", wire),
  sampleVars: {"count":"4 games","date":"Thu 19 Nov","empty":"","empty2":"","g1_a":"GS","g1_ac":"#8A8A8A","g1_an":"Warriors","g1_as":"98","g1_dot":-200,"g1_h":"MEM","g1_hc":"#FFFFFF","g1_hn":"Grizzlies","g1_hs":"126","g1_sc":"#B0B0B0","g1_st":"Final","g2_a":"POR","g2_ac":"#FFFFFF","g2_an":"Trail Blazers","g2_as":"124","g2_by":70,"g2_dot":-200,"g2_h":"MIL","g2_hc":"#8A8A8A","g2_hn":"Bucks","g2_hs":"114","g2_sc":"#B0B0B0","g2_st":"Final","g3_a":"NY","g3_ac":"#FFFFFF","g3_an":"Knicks","g3_as":"102","g3_dot":-200,"g3_h":"MIN","g3_hc":"#8A8A8A","g3_hn":"Timberwolves","g3_hs":"99","g3_sc":"#B0B0B0","g3_st":"Final","g4_a":"LAC","g4_ac":"#8A8A8A","g4_an":"Clippers","g4_as":"112","g4_by":154,"g4_dot":-200,"g4_h":"SA","g4_hc":"#FFFFFF","g4_hn":"Spurs","g4_hs":"124","g4_sc":"#B0B0B0","g4_st":"Final","g5_a":"","g5_ac":"#FFFFFF","g5_an":"","g5_as":"","g5_dot":-200,"g5_h":"","g5_hc":"#FFFFFF","g5_hn":"","g5_hs":"","g5_sc":"#B0B0B0","g5_st":""},
};

export default template;
