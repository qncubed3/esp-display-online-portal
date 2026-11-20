import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Premier League scoreboard: the current matchweek's 10 games, one row each.

const TOP = 28; // y of the first game row
const ROW_H = 21; // 10 rows fill 28..238

const code = String.raw`// The current Premier League matchweek from ESPN's public scoreboard (site.api.espn.com, free, no key).
// ESPN's season calendar lists every match date; consecutive dates form a matchweek. It shows the
// matchweek in progress, the one just finished (for SHOW_RESULTS_DAYS), or else the next one.
// Kick-off times are in your local time; live games show the minute in red.
const SHOW_RESULTS_DAYS = 2; // keep showing a finished matchweek's results this many days
const GAMES = 10; // rows on screen
const WIN = "#FFFFFF", LOSE = "#8A8A8A", LIVE = "#FF5252", DONE = "#9A9A9A", NEXT = "#00FF85";
const OFF = -200; // y that hides a stripe
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Font 2 character widths (ASCII 32..126), to fit team names in their column.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
function pad(n) { return (n < 10 ? "0" : "") + n; }
function ascii(s) { return String(s || "").replace(/[^A-Za-z0-9 .'&-]/g, "").trim(); }
function fit(s, max) {
  let w = 0, out = "";
  for (const ch of s) {
    w += W2[ch.charCodeAt(0) - 32] || 7;
    if (w > max) return out.trim();
    out += ch;
  }
  return out;
}
function dayNum(ymd) {
  const p = String(ymd).split("-").map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
}
function ymdOf(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }

let base = null;
try {
  base = await get(BASE, { cache: 60 });
} catch (e) {
  console.log("epl-scores: " + e.message);
}
const today = (base && base.day && base.day.date) || new Date().toISOString().slice(0, 10);
const t = dayNum(today);

// Group the calendar's match dates into matchweeks (runs of consecutive days) and pick one.
const cal = (((base && base.leagues) || [])[0] || {}).calendar || [];
const dates = cal.map((c) => String((c && c.startDate) || c).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .map(dayNum).sort((a, b) => a - b).filter((d, i, a) => i === 0 || d !== a[i - 1]);
const weeks = [];
for (const d of dates) {
  const w = weeks[weeks.length - 1];
  if (w && d - w[w.length - 1] === 1) w.push(d);
  else weeks.push([d]);
}
let week = weeks.find((w) => w[0] <= t && t <= w[w.length - 1]);
if (!week) {
  const prev = weeks.filter((w) => w[w.length - 1] < t).pop();
  const next = weeks.find((w) => w[0] > t);
  week = prev && t - prev[prev.length - 1] <= SHOW_RESULTS_DAYS ? prev : (next || prev);
}
week = (week || []).slice(0, 5);

// One request per match date (today's is already in the base response).
let events = [];
let failed = !base;
for (const d of week) {
  if (d === t && base && Array.isArray(base.events)) {
    events = events.concat(base.events);
    continue;
  }
  try {
    const r = await get(BASE + "?dates=" + ymdOf(d).replace(/-/g, ""), { cache: d < t - 1 ? 3600 : d > t ? 300 : 60 });
    events = events.concat(r && Array.isArray(r.events) ? r.events : []);
  } catch (e) {
    console.log("epl-scores: " + e.message);
    failed = true;
  }
}
if (!week.length && base && Array.isArray(base.events)) events = base.events;
const seen = {};
events = events.filter((e) => e && !seen[e.id] && (seen[e.id] = true));
events.sort((a, b) => (Date.parse(a.date) - Date.parse(b.date)) || String(a.shortName).localeCompare(String(b.shortName)));

// Owner's UTC offset, from now() vs the real clock, to show kick-off times in local time.
const nowSec = Math.floor(Date.now() / 1000);
const m = now("YYYY MM DD HH mm").split(" ").map(Number);
const offMin = Math.round((Date.UTC(m[0], m[1] - 1, m[2], m[3], m[4]) / 1000 - nowSec) / 900) * 15;
function kickoff(iso) {
  const ms = Date.parse(iso);
  if (!isFinite(ms)) return "TBD";
  const d = new Date(ms + offMin * 60000);
  return DAYS[d.getUTCDay()] + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}
function status(st) {
  const ty = (st && st.type) || {};
  const name = ty.name || "";
  if (ty.state === "in") {
    if (name === "STATUS_HALFTIME") return "HT";
    const c = String(st.displayClock || "").replace(/[^0-9+]/g, "");
    return c ? c + "'" : "Live";
  }
  if (ty.state === "post") {
    if (name === "STATUS_POSTPONED") return "PPD";
    if (name === "STATUS_CANCELED" || name === "STATUS_ABANDONED") return "Canc";
    return "FT";
  }
  if (name === "STATUS_POSTPONED") return "PPD";
  return null;
}

let games = events.map((e, i) => ({ e, i, s: ((e.status || {}).type || {}).state || "pre" }));
if (games.length > GAMES) {
  const rank = { in: 0, pre: 1, post: 2 };
  games = games.slice().sort((a, b) => (rank[a.s] - rank[b.s]) || a.i - b.i).slice(0, GAMES);
  games.sort((a, b) => a.i - b.i);
}

function row(i) {
  const g = games[i];
  const r = { st: "", h: "", a: "", sc: "", stc: DONE, hc: WIN, ac: WIN, scc: WIN };
  if (!g) return r;
  const comp = (g.e.competitions || [])[0] || {};
  const teams = comp.competitors || [];
  const home = teams.find((x) => x.homeAway === "home") || teams[0] || {};
  const away = teams.find((x) => x.homeAway === "away") || teams[1] || {};
  const name = (tm) => ascii(tm && (tm.shortDisplayName || tm.abbreviation)) || "TBA";
  r.h = fit(name(home.team), 92);
  r.a = fit(name(away.team), 92);
  const s = status(g.e.status || comp.status);
  if (s === null || s === "PPD" || s === "Canc") {
    r.st = s || kickoff(g.e.date);
    r.stc = s ? DONE : NEXT;
    r.sc = "v";
    r.scc = LOSE;
    return r;
  }
  r.st = s;
  const hs = String(home.score == null ? "0" : home.score), as = String(away.score == null ? "0" : away.score);
  r.sc = hs + "-" + as;
  if (g.s === "in") {
    r.stc = LIVE;
    r.scc = LIVE;
  } else if (Number(hs) > Number(as)) r.ac = LOSE;
  else if (Number(as) > Number(hs)) r.hc = LOSE;
  return r;
}
const R = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(row);
export const g1_st = R[0].st, g1_h = R[0].h, g1_a = R[0].a, g1_sc = R[0].sc, g1_stc = R[0].stc, g1_hc = R[0].hc, g1_ac = R[0].ac, g1_scc = R[0].scc;
export const g2_st = R[1].st, g2_h = R[1].h, g2_a = R[1].a, g2_sc = R[1].sc, g2_stc = R[1].stc, g2_hc = R[1].hc, g2_ac = R[1].ac, g2_scc = R[1].scc;
export const g3_st = R[2].st, g3_h = R[2].h, g3_a = R[2].a, g3_sc = R[2].sc, g3_stc = R[2].stc, g3_hc = R[2].hc, g3_ac = R[2].ac, g3_scc = R[2].scc;
export const g4_st = R[3].st, g4_h = R[3].h, g4_a = R[3].a, g4_sc = R[3].sc, g4_stc = R[3].stc, g4_hc = R[3].hc, g4_ac = R[3].ac, g4_scc = R[3].scc;
export const g5_st = R[4].st, g5_h = R[4].h, g5_a = R[4].a, g5_sc = R[4].sc, g5_stc = R[4].stc, g5_hc = R[4].hc, g5_ac = R[4].ac, g5_scc = R[4].scc;
export const g6_st = R[5].st, g6_h = R[5].h, g6_a = R[5].a, g6_sc = R[5].sc, g6_stc = R[5].stc, g6_hc = R[5].hc, g6_ac = R[5].ac, g6_scc = R[5].scc;
export const g7_st = R[6].st, g7_h = R[6].h, g7_a = R[6].a, g7_sc = R[6].sc, g7_stc = R[6].stc, g7_hc = R[6].hc, g7_ac = R[6].ac, g7_scc = R[6].scc;
export const g8_st = R[7].st, g8_h = R[7].h, g8_a = R[7].a, g8_sc = R[7].sc, g8_stc = R[7].stc, g8_hc = R[7].hc, g8_ac = R[7].ac, g8_scc = R[7].scc;
export const g9_st = R[8].st, g9_h = R[8].h, g9_a = R[8].a, g9_sc = R[8].sc, g9_stc = R[8].stc, g9_hc = R[8].hc, g9_ac = R[8].ac, g9_scc = R[8].scc;
export const g10_st = R[9].st, g10_h = R[9].h, g10_a = R[9].a, g10_sc = R[9].sc, g10_stc = R[9].stc, g10_hc = R[9].hc, g10_ac = R[9].ac, g10_scc = R[9].scc;

// Stripes behind even rows, hidden when the row is empty.
export const g2_by = R[1].h ? 49 : OFF, g4_by = R[3].h ? 91 : OFF, g6_by = R[5].h ? 133 : OFF;
export const g8_by = R[7].h ? 175 : OFF, g10_by = R[9].h ? 217 : OFF;

// Header: the matchweek's date range, e.g. "21-23 Nov" or "29 Nov-1 Dec".
function range(w) {
  if (!w.length) return now("DD/MM");
  const a = new Date(w[0] * 86400000), b = new Date(w[w.length - 1] * 86400000);
  const ma = MONTHS[a.getUTCMonth()], mb = MONTHS[b.getUTCMonth()];
  if (w.length === 1) return a.getUTCDate() + " " + ma;
  if (ma === mb) return a.getUTCDate() + "-" + b.getUTCDate() + " " + mb;
  return a.getUTCDate() + " " + ma + "-" + b.getUTCDate() + " " + mb;
}
// Prefer the first and last kick-off dates in local time; fall back to the calendar dates.
function localDay(iso) {
  const ms = Date.parse(iso);
  return isFinite(ms) ? Math.floor((ms + offMin * 60000) / 86400000) : NaN;
}
const kd = events.map((e) => localDay(e.date)).filter((d) => isFinite(d));
export const dates_label = range(kd.length ? [Math.min.apply(null, kd), Math.max.apply(null, kd)].filter((d, i, x) => i === 0 || d !== x[0]) : week);
export const empty = games.length ? "" : (failed ? "No data" : "No matches");
export const empty2 = games.length || failed ? "" : "Check back next matchweek";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#38003C"],
  ["text", "Premier League", 8, 13, 2, 1, "ML", "#00FF85"],
  ["text", "{dates_label}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  ...Array.from({ length: 10 }, (_, i) => i).flatMap((i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    const c = y + 11; // text centre line
    return [
      ...(i % 2 === 1 ? ([["fillRect", 0, `{g${n}_by}`, 320, ROW_H, "#1A0A1E"]] as RawWireOp[]) : []),
      ["text", `{g${n}_st}`, 8, c, 2, 1, "ML", `{g${n}_stc}`],
      ["text", `{g${n}_h}`, 172, c, 2, 1, "MR", `{g${n}_hc}`],
      ["text", `{g${n}_sc}`, 196, c, 2, 1, "MC", `{g${n}_scc}`],
      ["text", `{g${n}_a}`, 220, c, 2, 1, "ML", `{g${n}_ac}`],
    ];
  }),
  ["text", "{empty}", 160, 110, 4, 1, "MC", "#FFFFFF"],
  ["text", "{empty2}", 160, 145, 2, 1, "MC", "#00FF85"],
];

const template: Template = {
  id: "epl-scores",
  name: "Premier League scores",
  description: "The current Premier League matchweek: all 10 games with scores, the live minute in red, full-time results and local kick-off times.",
  apis: ["ESPN"],
  category: "sports",
  dataCode: code,
  rows: rows("epl-scores", wire),
  sampleVars: {"dates_label":"7-9 Nov","empty":"","empty2":"","g10_a":"Aston Villa","g10_ac":"#FFFFFF","g10_by":217,"g10_h":"Man Utd","g10_hc":"#FFFFFF","g10_sc":"4-4","g10_scc":"#FFFFFF","g10_st":"FT","g10_stc":"#9A9A9A","g1_a":"Coventry","g1_ac":"#8A8A8A","g1_h":"Everton","g1_hc":"#FFFFFF","g1_sc":"3-1","g1_scc":"#FFFFFF","g1_st":"FT","g1_stc":"#9A9A9A","g2_a":"Spurs","g2_ac":"#8A8A8A","g2_by":49,"g2_h":"Leeds","g2_hc":"#FFFFFF","g2_sc":"1-0","g2_scc":"#FFFFFF","g2_st":"FT","g2_stc":"#9A9A9A","g3_a":"Hull","g3_ac":"#8A8A8A","g3_h":"Arsenal","g3_hc":"#FFFFFF","g3_sc":"1-0","g3_scc":"#FFFFFF","g3_st":"FT","g3_stc":"#9A9A9A","g4_a":"Newcastle","g4_ac":"#FFFFFF","g4_by":91,"g4_h":"Fulham","g4_hc":"#FFFFFF","g4_sc":"1-1","g4_scc":"#FFFFFF","g4_st":"FT","g4_stc":"#9A9A9A","g5_a":"Man City","g5_ac":"#8A8A8A","g5_h":"Nottm Forest","g5_hc":"#FFFFFF","g5_sc":"3-1","g5_scc":"#FFFFFF","g5_st":"FT","g5_stc":"#9A9A9A","g6_a":"Bournemouth","g6_ac":"#FFFFFF","g6_by":133,"g6_h":"Ipswich","g6_hc":"#8A8A8A","g6_sc":"1-2","g6_scc":"#FFFFFF","g6_st":"FT","g6_stc":"#9A9A9A","g7_a":"Brentford","g7_ac":"#8A8A8A","g7_h":"Brighton","g7_hc":"#FFFFFF","g7_sc":"2-0","g7_scc":"#FFFFFF","g7_st":"FT","g7_stc":"#9A9A9A","g8_a":"Chelsea","g8_ac":"#8A8A8A","g8_by":175,"g8_h":"Sunderland","g8_hc":"#FFFFFF","g8_sc":"1-0","g8_scc":"#FFFFFF","g8_st":"FT","g8_stc":"#9A9A9A","g9_a":"Liverpool","g9_ac":"#FFFFFF","g9_h":"C Palace","g9_hc":"#8A8A8A","g9_sc":"1-3","g9_scc":"#FFFFFF","g9_st":"FT","g9_stc":"#9A9A9A"},
};

export default template;
