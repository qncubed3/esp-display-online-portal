import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// A-League Men round: up to 6 matches as "HOME 2-1 AWAY" rows with club colour chips,
// on a mown-pitch green theme. Status column: kick-off day and local time, live minute, or FT.

const TOP = 28; // y of the first match row
const ROW_H = 35; // 6 rows fill 28..238
const N = 6;

const code = String.raw`// A-League Men scores from ESPN's public scoreboard (site.api.espn.com, free, no key).
// Shows the current round (the match days ESPN lists together), or the last round's
// results until the next round is closer. Kick-off times are in your local time.
const ROWS = 6; // matches on screen
const WIN = "#FFFFFF", LOSE = "#7C8C80", LIVE = "#FF5252", FT = "#B6F23A", NEXT = "#E0E0E0", DIM = "#8FA894";
const OFF = -200; // y that hides shapes
const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/aus.1/scoreboard";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad(n) { return (n < 10 ? "0" : "") + n; }
function ascii(s) { return String(s || "").replace(/[^A-Za-z0-9 .'+-]/g, "").trim(); }
function dayNum(ymd) { // "2026-11-20" -> days since epoch
  const p = String(ymd).slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}
function ymdOf(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }

let data = null;
try {
  data = await get(BASE, { cache: 60 });
} catch (e) {
  console.log("a-league-scores: " + e.message);
}

// Owner's UTC offset, from now() vs the real clock, to show kick-off times in local time.
const nowMs = Date.now();
const m = now("YYYY MM DD HH mm").split(" ").map(Number);
const offMin = Math.round((Date.UTC(m[0], m[1] - 1, m[2], m[3], m[4]) - nowMs) / 900000) * 15;
function local(iso) {
  const t = Date.parse(iso);
  return isFinite(t) ? new Date(t + offMin * 60000) : null;
}

// Group ESPN's match-day calendar into rounds (a gap of 3+ days starts a new round).
const today = data && data.day && data.day.date ? dayNum(data.day.date) : dayNum(new Date(nowMs - 5 * 3600000).toISOString());
const cal = [];
(((data && data.leagues) || [])[0] || {}).calendar && data.leagues[0].calendar.forEach((c) => {
  const s = String((c && c.startDate) || c).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) cal.push(dayNum(s));
});
cal.sort((a, b) => a - b);
const rounds = [];
cal.forEach((d) => {
  const r = rounds[rounds.length - 1];
  if (r && d - r[r.length - 1] <= 2) { if (d !== r[r.length - 1]) r.push(d); }
  else rounds.push([d]);
});
let ri = rounds.findIndex((r) => r[r.length - 1] >= today);
if (ri < 0) ri = rounds.length - 1;
else if (ri > 0 && rounds[ri][0] > today) {
  const prev = rounds[ri - 1];
  if (today - prev[prev.length - 1] < rounds[ri][0] - today) ri = ri - 1;
}
let days = ri >= 0 ? rounds[ri] : [];
if (days.length > 4) { // long holiday stretches: 4 days around today
  let s = Math.max(0, days.findIndex((d) => d >= today - 1));
  s = Math.min(s, days.length - 4);
  days = days.slice(s, s + 4);
}

// Fetch each match day of the round (the default response already holds ESPN's "today").
const events = [];
const seen = {};
function add(list) {
  (list || []).forEach((e) => { if (e && !seen[e.id]) { seen[e.id] = 1; events.push(e); } });
}
const todayHeld = data && data.day && data.day.date ? dayNum(data.day.date) : null;
if (data && (!days.length || days.indexOf(todayHeld) >= 0)) add(data.events);
for (const d of days) {
  if (d === todayHeld) continue;
  try {
    const r = await get(BASE + "?dates=" + ymdOf(d).replace(/-/g, ""), { cache: 60 });
    add(r && r.events);
  } catch (e) {
    console.log("a-league-scores " + ymdOf(d) + ": " + e.message);
  }
}
events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
const state = (e) => (((e.status || {}).type || {}).state) || "pre";
let games = events.slice();
while (games.length > ROWS) { // drop the oldest result first, else the latest fixture
  const i = games.findIndex((e) => state(e) === "post");
  games.splice(i >= 0 ? i : games.length - 1, 1);
}

function abbr(team) { return ascii(team && team.abbreviation).toUpperCase().slice(0, 4) || "TBA"; }
function chip(team) { // club colour, avoiding colours too dark to see on the pitch green
  const ok = (h) => {
    if (!/^[0-9a-fA-F]{6}$/.test(h || "")) return false;
    const v = parseInt(h, 16);
    return 0.3 * (v >> 16) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255) > 50;
  };
  const c = team && team.color, a = team && team.alternateColor;
  return "#" + (ok(c) ? c : ok(a) ? a : "9E9E9E").toUpperCase();
}

function row(i) {
  const e = games[i];
  const c = 28 + i * 35 + 17; // row centre (rows start at y 28, 35 px each)
  const r = { h: "", a: "", sc: "", s1: "", s2: "", s1y: c, hc: WIN, ac: WIN, scc: WIN, stc: NEXT, hk: "#000000", ak: "#000000", ky: OFF, by: OFF };
  if (!e) return r;
  const comp = (e.competitions || [])[0] || {};
  const teams = comp.competitors || [];
  const home = teams.find((t) => t.homeAway === "home") || teams[0] || {};
  const away = teams.find((t) => t.homeAway === "away") || teams[1] || {};
  r.h = abbr(home.team);
  r.a = abbr(away.team);
  r.hk = chip(home.team);
  r.ak = chip(away.team);
  r.ky = c - 11;
  r.by = c - 13;
  const st = e.status || comp.status || {};
  const t = st.type || {};
  const hs = home.score == null ? "" : String(home.score), as = away.score == null ? "" : String(away.score);
  if (t.state === "pre" || !t.state) {
    const d = local(e.date);
    if (t.name === "STATUS_POSTPONED") { r.s1 = "PPD"; r.stc = LIVE; }
    else if (d) { r.s1 = DAYS[d.getUTCDay()]; r.s2 = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); r.s1y = c - 8; }
    else r.s1 = "TBD";
    r.sc = "v";
    r.scc = DIM;
    return r;
  }
  r.sc = hs + "-" + as;
  if (t.state === "in") {
    r.stc = LIVE;
    if (t.name === "STATUS_HALFTIME") r.s1 = "HT";
    else { r.s1 = ascii(st.displayClock).slice(0, 7) || "LIVE"; r.s2 = "LIVE"; r.s1y = c - 8; }
    return r;
  }
  // post
  r.stc = FT;
  if (t.name === "STATUS_POSTPONED" || t.name === "STATUS_CANCELED") {
    r.s1 = t.name === "STATUS_POSTPONED" ? "PPD" : "Canc";
    r.sc = "v";
    r.scc = DIM;
    return r;
  }
  r.s1 = ascii(t.shortDetail || "FT").slice(0, 6) || "FT";
  const hv = Number(hs), av = Number(as);
  if (home.winner === true || hv > av) r.ac = LOSE;
  else if (away.winner === true || av > hv) r.hc = LOSE;
  return r;
}
const R = [0, 1, 2, 3, 4, 5].map(row);
export const m1_h = R[0].h, m1_a = R[0].a, m1_sc = R[0].sc, m1_s1 = R[0].s1, m1_s2 = R[0].s2, m1_s1y = R[0].s1y, m1_hc = R[0].hc, m1_ac = R[0].ac, m1_scc = R[0].scc, m1_stc = R[0].stc, m1_hk = R[0].hk, m1_ak = R[0].ak, m1_ky = R[0].ky, m1_by = R[0].by;
export const m2_h = R[1].h, m2_a = R[1].a, m2_sc = R[1].sc, m2_s1 = R[1].s1, m2_s2 = R[1].s2, m2_s1y = R[1].s1y, m2_hc = R[1].hc, m2_ac = R[1].ac, m2_scc = R[1].scc, m2_stc = R[1].stc, m2_hk = R[1].hk, m2_ak = R[1].ak, m2_ky = R[1].ky, m2_by = R[1].by;
export const m3_h = R[2].h, m3_a = R[2].a, m3_sc = R[2].sc, m3_s1 = R[2].s1, m3_s2 = R[2].s2, m3_s1y = R[2].s1y, m3_hc = R[2].hc, m3_ac = R[2].ac, m3_scc = R[2].scc, m3_stc = R[2].stc, m3_hk = R[2].hk, m3_ak = R[2].ak, m3_ky = R[2].ky, m3_by = R[2].by;
export const m4_h = R[3].h, m4_a = R[3].a, m4_sc = R[3].sc, m4_s1 = R[3].s1, m4_s2 = R[3].s2, m4_s1y = R[3].s1y, m4_hc = R[3].hc, m4_ac = R[3].ac, m4_scc = R[3].scc, m4_stc = R[3].stc, m4_hk = R[3].hk, m4_ak = R[3].ak, m4_ky = R[3].ky, m4_by = R[3].by;
export const m5_h = R[4].h, m5_a = R[4].a, m5_sc = R[4].sc, m5_s1 = R[4].s1, m5_s2 = R[4].s2, m5_s1y = R[4].s1y, m5_hc = R[4].hc, m5_ac = R[4].ac, m5_scc = R[4].scc, m5_stc = R[4].stc, m5_hk = R[4].hk, m5_ak = R[4].ak, m5_ky = R[4].ky, m5_by = R[4].by;
export const m6_h = R[5].h, m6_a = R[5].a, m6_sc = R[5].sc, m6_s1 = R[5].s1, m6_s2 = R[5].s2, m6_s1y = R[5].s1y, m6_hc = R[5].hc, m6_ac = R[5].ac, m6_scc = R[5].scc, m6_stc = R[5].stc, m6_hk = R[5].hk, m6_ak = R[5].ak, m6_ky = R[5].ky, m6_by = R[5].by;

// Mown-pitch stripes behind rows 2, 4 and 6, hidden when the row is empty.
export const m2_sy = R[1].h ? 63 : OFF, m4_sy = R[3].h ? 133 : OFF, m6_sy = R[5].h ? 203 : OFF;

// Header: the round's dates, e.g. "20-21 Nov" or "28 Nov-1 Dec".
function range(a, b) {
  const x = new Date(a * 86400000), y = new Date(b * 86400000);
  const mx = MONTHS[x.getUTCMonth()], my = MONTHS[y.getUTCMonth()];
  if (a === b) return DAYS[x.getUTCDay()] + " " + x.getUTCDate() + " " + mx;
  return x.getUTCDate() + (mx === my ? "" : " " + mx) + "-" + y.getUTCDate() + " " + my;
}
export const dates = days.length ? range(days[0], days[days.length - 1]) : now("ddd DD/MM");
let nextTxt = "";
if (data && !events.length) {
  const after = cal.filter((d) => d > today)[0];
  if (after) nextTxt = "Next: " + range(after, after);
}
export const empty = !data ? "No data" : (events.length ? "" : "No matches");
export const empty2 = nextTxt;
`;

const PITCH = "#08170E";
const STRIPE = "#0F2617";

const wire: RawWireOp[] = [
  ["fillScreen", PITCH],
  ["fillRect", 0, 0, 320, 26, "#B6F23A"],
  ["text", "A-LEAGUE", 8, 13, 2, 1, "ML", "#08170E"],
  ["text", "MEN", 82, 13, 2, 1, "ML", "#2E5A1C"],
  ["text", "{dates}", 312, 13, 2, 1, "MR", "#08170E"],
  ...Array.from({ length: N }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const c = TOP + i * ROW_H + 17;
    return [
      ...(i % 2 === 1 ? ([["fillRect", 0, `{m${n}_sy}`, 320, ROW_H, STRIPE]] as RawWireOp[]) : []),
      ["text", `{m${n}_s1}`, 30, `{m${n}_s1y}`, 2, 1, "MC", `{m${n}_stc}`],
      ["text", `{m${n}_s2}`, 30, c + 8, 2, 1, "MC", `{m${n}_stc}`],
      ["fillRect", 62, `{m${n}_ky}`, 5, 22, `{m${n}_hk}`],
      ["text", `{m${n}_h}`, 74, c, 4, 1, "ML", `{m${n}_hc}`],
      ["fillRoundRect", 156, `{m${n}_by}`, 60, 26, 5, "#1D4A2C"],
      ["text", `{m${n}_sc}`, 186, c, 4, 1, "MC", `{m${n}_scc}`],
      ["text", `{m${n}_a}`, 298, c, 4, 1, "MR", `{m${n}_ac}`],
      ["fillRect", 304, `{m${n}_ky}`, 5, 22, `{m${n}_ak}`],
    ];
  }).flat(),
  ["text", "{empty}", 160, 110, 4, 1, "MC", "#FFFFFF"],
  ["text", "{empty2}", 160, 145, 2, 1, "MC", "#B6F23A"],
];

const template: Template = {
  id: "a-league-scores",
  name: "A-League scores",
  description: "The current A-League Men round: home and away scores with club colours, the live minute, full time, or local kick-off day and time.",
  apis: ["ESPN"],
  category: "sports",
  dataCode: code,
  rows: rows("a-league-scores", wire),
  sampleVars: {"dates":"20-21 Nov","empty":"","empty2":"","m1_a":"ADL","m1_ac":"#7C8C80","m1_ak":"#EA413C","m1_by":32,"m1_h":"WSW","m1_hc":"#FFFFFF","m1_hk":"#C60000","m1_ky":34,"m1_s1":"FT","m1_s1y":45,"m1_s2":"","m1_sc":"4-2","m1_scc":"#FFFFFF","m1_stc":"#B6F23A","m2_a":"MBV","m2_ac":"#FFFFFF","m2_ak":"#104C94","m2_by":67,"m2_h":"AUC","m2_hc":"#FFFFFF","m2_hk":"#9E9E9E","m2_ky":69,"m2_s1":"Sat","m2_s1y":72,"m2_s2":"15:00","m2_sc":"v","m2_scc":"#8FA894","m2_stc":"#E0E0E0","m2_sy":63,"m3_a":"PER","m3_ac":"#FFFFFF","m3_ak":"#562D84","m3_by":102,"m3_h":"CCM","m3_hc":"#FFFFFF","m3_hk":"#F5FE05","m3_ky":104,"m3_s1":"Sat","m3_s1y":107,"m3_s2":"17:00","m3_sc":"v","m3_scc":"#8FA894","m3_stc":"#E0E0E0","m4_a":"SYD","m4_ac":"#FFFFFF","m4_ak":"#87CEFA","m4_by":137,"m4_h":"BRI","m4_hc":"#FFFFFF","m4_hk":"#F5A12D","m4_ky":139,"m4_s1":"Sat","m4_s1y":142,"m4_s2":"19:40","m4_sc":"v","m4_scc":"#8FA894","m4_stc":"#E0E0E0","m4_sy":133,"m5_a":"MAC","m5_ac":"#FFFFFF","m5_ak":"#DBC242","m5_by":172,"m5_h":"WEL","m5_hc":"#FFFFFF","m5_hk":"#F5FE05","m5_ky":174,"m5_s1":"Sun","m5_s1y":177,"m5_s2":"13:00","m5_sc":"v","m5_scc":"#8FA894","m5_stc":"#E0E0E0","m6_a":"","m6_ac":"#FFFFFF","m6_ak":"#000000","m6_by":-200,"m6_h":"","m6_hc":"#FFFFFF","m6_hk":"#000000","m6_ky":-200,"m6_s1":"","m6_s1y":220,"m6_s2":"","m6_sc":"","m6_scc":"#FFFFFF","m6_stc":"#E0E0E0","m6_sy":-200},
};

export default template;
