import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// NRL scoreboard: the current round as a list (up to 8 games, a full NRL round), or one big
// match card when the round is a single game (Grand Final, State of Origin, off-season).

const TOP = 30; // y of the first list row
const ROW_H = 26; // 8 rows fill 30..238

const code = String.raw`// NRL scores from ESPN's public scoreboard (site.api.espn.com, free, no key, unofficial).
// It returns the current round: a full round is listed (home team on the left), and a
// single-game round (Grand Final, Origin) gets a big match card. In the off-season ESPN keeps
// returning last season's Grand Final, so the card shows it with an "Off-season" note.
// Kick-off times are shown in your local time.
const GAMES = 8; // list rows on screen
const WIN = "#FFFFFF", LOSE = "#8A8A8A", LIVE = "#FF5252", DONE = "#B0B0B0", NEXT = "#FFC400";
const OFF = -200; // y that hides a shape

// Shorter names for the list column (about 80 px of font 2).
const SHORT = { "Wests Tigers": "Tigers", "New South Wales": "NSW", "Queensland": "QLD" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad(n) { return (n < 10 ? "0" : "") + n; }
function ascii(s) { return String(s || "").replace(/[^A-Za-z0-9 .'-]/g, "").trim(); }

let data = null;
try {
  data = await get("https://site.api.espn.com/apis/site/v2/sports/rugby-league/3/scoreboard", { cache: 60 });
} catch (e) {
  console.log("nrl-scores: " + e.message);
}
const events = data && Array.isArray(data.events) ? data.events : [];
const nowMs = Date.now();

// Owner's UTC offset, from now() vs the real clock, for local kick-off times.
const m = now("YYYY MM DD HH mm").split(" ").map(Number);
const offMin = Math.round((Date.UTC(m[0], m[1] - 1, m[2], m[3], m[4]) - nowMs) / 900000) * 15;
function local(iso) {
  const t = Date.parse(iso);
  return isFinite(t) ? new Date(t + offMin * 60000) : null;
}
function kickoff(iso) {
  const d = local(iso);
  if (!d) return "TBD";
  if (Date.parse(iso) - nowMs > 6 * 86400000) return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  return DAYS[d.getUTCDay()] + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}
function longDate(iso) {
  const d = local(iso);
  return d ? DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear() : "";
}
function nick(team) {
  return ascii(team && (team.shortDisplayName || team.name)) || "TBA";
}
// Status: null before kick-off, otherwise a short label.
function status(st) {
  const t = (st && st.type) || {};
  const name = t.name || "";
  if (t.state === "in") {
    if (name === "STATUS_HALFTIME") return "HT";
    const c = String(st.displayClock || "").replace(/[^0-9:']/g, "");
    return c || "Live";
  }
  if (t.state === "post") {
    if (name === "STATUS_POSTPONED") return "PPD";
    if (name === "STATUS_CANCELED") return "Canc";
    return "FT";
  }
  return null;
}

// Round label from the league calendar entry that contains the first game.
let label = "";
const first = events[0];
if (first) {
  const t = Date.parse(first.date);
  const cal = (((data.leagues || [])[0] || {}).calendar || []);
  for (const sec of cal) {
    for (const en of (sec && sec.entries) || []) {
      if (t >= Date.parse(en.startDate) && t <= Date.parse(en.endDate)) label = ascii(en.label);
    }
  }
  if (!label && data.week && data.week.number) label = "Round " + data.week.number;
}
label = label.replace("Preliminary", "Prelim").replace("Qualifying", "Qual").slice(0, 18);

function game(e) {
  const comp = (e.competitions || [])[0] || {};
  const teams = comp.competitors || [];
  const home = teams.find((t) => t.homeAway === "home") || teams[0] || {};
  const away = teams.find((t) => t.homeAway === "away") || teams[1] || {};
  const g = { h: nick(home.team), a: nick(away.team), hs: "", as: "", st: "", hc: WIN, ac: WIN, sc: DONE,
    state: ((e.status || {}).type || {}).state || "pre", date: e.date,
    venue: ascii(comp.venue && comp.venue.fullName) };
  const s = status(e.status || comp.status);
  if (s === null) {
    g.st = kickoff(e.date);
    g.sc = NEXT;
    return g;
  }
  g.st = s;
  if (s !== "PPD" && s !== "Canc") {
    g.hs = String(home.score == null ? "" : home.score);
    g.as = String(away.score == null ? "" : away.score);
  }
  if (g.state === "in") g.sc = LIVE;
  else if (g.hs !== "" && g.as !== "") {
    const hv = Number(g.hs), av = Number(g.as);
    if (hv > av) g.ac = LOSE;
    else if (av > hv) g.hc = LOSE;
  }
  return g;
}

// Live games first if the round has more games than rows, then back in date order.
const rank = { in: 0, pre: 1, post: 2 };
let list = events.map((e, i) => ({ g: game(e), i }));
if (list.length > GAMES) {
  list = list.slice().sort((a, b) => (rank[a.g.state] - rank[b.g.state]) || a.i - b.i).slice(0, GAMES);
  list.sort((a, b) => a.i - b.i);
}
const many = list.length >= 2;

function row(i) {
  const g = many && list[i] ? list[i].g : null;
  if (!g) return { h: "", a: "", hs: "", as: "", st: "", hc: WIN, ac: WIN, sc: DONE, by: OFF };
  return { h: SHORT[g.h] || g.h, a: SHORT[g.a] || g.a, hs: g.hs, as: g.as, st: g.st, hc: g.hc, ac: g.ac, sc: g.sc,
    by: i % 2 === 1 ? 30 + i * 26 : OFF };
}
const R = [0, 1, 2, 3, 4, 5, 6, 7].map(row);
export const r1_h = R[0].h, r1_a = R[0].a, r1_hs = R[0].hs, r1_as = R[0].as, r1_st = R[0].st, r1_hc = R[0].hc, r1_ac = R[0].ac, r1_sc = R[0].sc;
export const r2_h = R[1].h, r2_a = R[1].a, r2_hs = R[1].hs, r2_as = R[1].as, r2_st = R[1].st, r2_hc = R[1].hc, r2_ac = R[1].ac, r2_sc = R[1].sc, r2_by = R[1].by;
export const r3_h = R[2].h, r3_a = R[2].a, r3_hs = R[2].hs, r3_as = R[2].as, r3_st = R[2].st, r3_hc = R[2].hc, r3_ac = R[2].ac, r3_sc = R[2].sc;
export const r4_h = R[3].h, r4_a = R[3].a, r4_hs = R[3].hs, r4_as = R[3].as, r4_st = R[3].st, r4_hc = R[3].hc, r4_ac = R[3].ac, r4_sc = R[3].sc, r4_by = R[3].by;
export const r5_h = R[4].h, r5_a = R[4].a, r5_hs = R[4].hs, r5_as = R[4].as, r5_st = R[4].st, r5_hc = R[4].hc, r5_ac = R[4].ac, r5_sc = R[4].sc;
export const r6_h = R[5].h, r6_a = R[5].a, r6_hs = R[5].hs, r6_as = R[5].as, r6_st = R[5].st, r6_hc = R[5].hc, r6_ac = R[5].ac, r6_sc = R[5].sc, r6_by = R[5].by;
export const r7_h = R[6].h, r7_a = R[6].a, r7_hs = R[6].hs, r7_as = R[6].as, r7_st = R[6].st, r7_hc = R[6].hc, r7_ac = R[6].ac, r7_sc = R[6].sc;
export const r8_h = R[7].h, r8_a = R[7].a, r8_hs = R[7].hs, r8_as = R[7].as, r8_st = R[7].st, r8_hc = R[7].hc, r8_ac = R[7].ac, r8_sc = R[7].sc, r8_by = R[7].by;

// Match card for a single-game round.
const f = !many && list[0] ? list[0].g : null;
export const f_when = f ? longDate(f.date) : "";
export const f_venue = f ? f.venue.slice(0, 40) : "";
export const f_h = f ? f.h : "", f_a = f ? f.a : "";
export const f_hs = f ? (f.hs || "-") : "", f_as = f ? (f.as || "-") : "";
export const f_hc = f ? f.hc : WIN, f_ac = f ? f.ac : WIN;
export const f_st = f ? f.st : "";
export const f_sc = f ? f.sc : DONE;
export const f_card = f ? 74 : OFF; // y of the card panel
let note = "";
if (f && f.state === "post" && nowMs - Date.parse(f.date) > 3 * 86400000) {
  const champ = /Grand Final/.test(label) && f.hc !== f.ac ? (f.hc === WIN ? f.h : f.a) : "";
  const yr = (local(f.date) || new Date()).getUTCFullYear();
  note = champ ? "Off-season - " + champ + " are " + yr + " premiers" : "Off-season";
}
export const f_note = note.slice(0, 44);

// Header, and the message when there is nothing to show.
export const title = "NRL";
export const round = label;
export const clock = now("HH:mm");
export const empty = !data ? "No data" : (events.length ? "" : "No games");
`;

const listRows: RawWireOp[] = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((i): RawWireOp[] => {
  const n = i + 1;
  const mid = TOP + i * ROW_H + ROW_H / 2;
  return [
    ...(i % 2 === 1 ? ([["fillRect", 0, `{r${n}_by}`, 320, ROW_H, "#0F1A14"]] as RawWireOp[]) : []),
    ["text", `{r${n}_h}`, 8, mid, 2, 1, "ML", `{r${n}_hc}`],
    ["text", `{r${n}_hs}`, 124, mid, 4, 1, "MR", `{r${n}_hc}`],
    ["text", `{r${n}_st}`, 160, mid, 2, 1, "MC", `{r${n}_sc}`],
    ["text", `{r${n}_as}`, 196, mid, 4, 1, "ML", `{r${n}_ac}`],
    ["text", `{r${n}_a}`, 312, mid, 2, 1, "MR", `{r${n}_ac}`],
  ];
});

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#08331C"],
  ["text", "{title}", 8, 13, 2, 1, "ML", "#4ADE80"],
  ["text", "{round}", 160, 13, 2, 1, "MC", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#D0D0D0"],
  ...listRows,
  // Match card
  ["text", "{f_when}", 160, 42, 2, 1, "MC", "#D0D0D0"],
  ["text", "{f_venue}", 160, 60, 1, 1, "MC", "#808080"],
  ["fillRoundRect", 8, "{f_card}", 304, 118, 8, "#0F1A14"],
  ["text", "{f_hs}", 84, 124, 4, 3, "MC", "{f_hc}"],
  ["text", "{f_as}", 236, 124, 4, 3, "MC", "{f_ac}"],
  ["text", "{f_st}", 160, 124, 2, 1, "MC", "{f_sc}"],
  ["text", "{f_h}", 84, 176, 4, 1, "MC", "{f_hc}"],
  ["text", "{f_a}", 236, 176, 4, 1, "MC", "{f_ac}"],
  ["text", "{f_note}", 160, 216, 2, 1, "MC", "#4ADE80"],
  ["text", "{empty}", 160, 120, 4, 1, "MC", "#FFFFFF"],
];

const template: Template = {
  id: "nrl-scores",
  name: "NRL scores",
  description: "The current NRL round: scores, live game clock and local kick-off times, with a big match card for the Grand Final and the off-season.",
  apis: ["ESPN"],
  category: "sports",
  dataCode: code,
  rows: rows("nrl-scores", wire),
  sampleVars: {"clock":"14:30","empty":"","f_a":"Knights","f_ac":"#8A8A8A","f_as":"18","f_card":74,"f_h":"Roosters","f_hc":"#FFFFFF","f_hs":"19","f_note":"Off-season - Roosters are 2026 premiers","f_sc":"#B0B0B0","f_st":"FT","f_venue":"Accor Stadium","f_when":"Sun 4 Oct 2026","r1_a":"","r1_ac":"#FFFFFF","r1_as":"","r1_h":"","r1_hc":"#FFFFFF","r1_hs":"","r1_sc":"#B0B0B0","r1_st":"","r2_a":"","r2_ac":"#FFFFFF","r2_as":"","r2_by":-200,"r2_h":"","r2_hc":"#FFFFFF","r2_hs":"","r2_sc":"#B0B0B0","r2_st":"","r3_a":"","r3_ac":"#FFFFFF","r3_as":"","r3_h":"","r3_hc":"#FFFFFF","r3_hs":"","r3_sc":"#B0B0B0","r3_st":"","r4_a":"","r4_ac":"#FFFFFF","r4_as":"","r4_by":-200,"r4_h":"","r4_hc":"#FFFFFF","r4_hs":"","r4_sc":"#B0B0B0","r4_st":"","r5_a":"","r5_ac":"#FFFFFF","r5_as":"","r5_h":"","r5_hc":"#FFFFFF","r5_hs":"","r5_sc":"#B0B0B0","r5_st":"","r6_a":"","r6_ac":"#FFFFFF","r6_as":"","r6_by":-200,"r6_h":"","r6_hc":"#FFFFFF","r6_hs":"","r6_sc":"#B0B0B0","r6_st":"","r7_a":"","r7_ac":"#FFFFFF","r7_as":"","r7_h":"","r7_hc":"#FFFFFF","r7_hs":"","r7_sc":"#B0B0B0","r7_st":"","r8_a":"","r8_ac":"#FFFFFF","r8_as":"","r8_by":-200,"r8_h":"","r8_hc":"#FFFFFF","r8_hs":"","r8_sc":"#B0B0B0","r8_st":"","round":"Grand Final","title":"NRL"},
};

export default template;
