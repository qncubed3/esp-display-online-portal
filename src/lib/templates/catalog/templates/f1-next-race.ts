import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Formula 1: next Grand Prix with a countdown, plus the top 5 of the drivers' championship (Jolpica)

const code = String.raw`// The next Formula 1 Grand Prix (name, circuit, local start time, countdown) and the
// top 5 of the drivers' championship, from Jolpica (the keyless Ergast replacement).
// When the season is over there is no next race: the screen says "Season over" with the final standings.
const CACHE_S = 3600;
const BASE = "https://api.jolpi.ca/ergast/f1/";

// Text widths at size 1 for chars 32-126 (from TFT_eSPI fonts 2 and 4), to fit text in Data.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
function width(s, w) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n += w[s.charCodeAt(i) - 32] || 0;
  return n;
}
function fit(s, w, max) {
  if (width(s, w) <= max) return s;
  while (s.length && width(s + "...", w) > max) s = s.slice(0, -1);
  return s.replace(/[\s,|-]+$/, "") + "...";
}
// The fonts are ASCII only (drivers like Hulkenberg and Perez have accents).
function ascii(s) {
  return String(s || "").normalize("NFD").replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "").trim();
}

// Offset of the owner's timezone from UTC, in ms (from now(), as there is no Intl here).
const nowMs = Date.now();
const local = Date.parse(now("YYYY-MM-DD") + "T" + now("HH:mm:ss") + "Z");
const tzOffset = Math.round((local - nowMs) / 60000) * 60000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n) => (n < 10 ? "0" : "") + n;
function localDate(ms) {
  const d = new Date(ms + tzOffset);
  return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + "  " +
    pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
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

const [nextRes, standRes] = await Promise.all([load("current/next.json"), load("current/driverStandings.json")]);
const races = nextRes && nextRes.MRData && nextRes.MRData.RaceTable ? nextRes.MRData.RaceTable.Races || [] : [];
let race = races[0];
let table = standingsOf(standRes);

// After the final round, "next" can point at the first race of a season that has no standings yet.
// Before that race, show the previous season's final table.
if (!table && race) table = standingsOf(await load((Number(race.season) - 1) + "/driverStandings.json"));

let title = "Season over", circuit = "", when = "", count = "", round = "F1";
if (!nextRes) {
  title = "No F1 data";
  circuit = "Jolpica unavailable";
} else if (race) {
  round = "F1  ROUND " + race.round;
  let name = ascii(race.raceName);
  if (width(name, W4) > 304) name = name.replace(/Grand Prix/, "GP");
  title = fit(name, W4, 304);
  const loc = race.Circuit && race.Circuit.Location ? ascii(race.Circuit.Location.locality) : "";
  circuit = fit(ascii(race.Circuit && race.Circuit.circuitName) + (loc ? ", " + loc : ""), W2, 304);
  const start = Date.parse(race.date + "T" + (race.time || "00:00:00Z"));
  if (!isNaN(start)) {
    when = race.time ? localDate(start) : localDate(start).replace(/\s+\d\d:\d\d$/, "");
    const mins = Math.floor((start - nowMs) / 60000);
    const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    if (mins <= 0) count = mins > -150 ? "Racing" : "Today";
    else if (d > 0) count = "in " + d + "d " + h + "h";
    else if (h > 0) count = "in " + h + "h " + m + "m";
    else count = "in " + m + "m";
  }
} else {
  const champ = table && table.DriverStandings && table.DriverStandings[0];
  if (champ && champ.Driver) circuit = fit(table.season + " champion: " + ascii(champ.Driver.givenName + " " + champ.Driver.familyName), W2, 304);
  if (table) round = "F1  " + table.season;
}

export const clock = now("HH:mm");
export { title, circuit, when, count, round };

// Standings: header label and five rows of position, code, surname, a points bar and points.
const list = table ? (table.DriverStandings || []).slice(0, 5) : [];
export const st_label = table
  ? "DRIVERS' CHAMPIONSHIP " + table.season + (race && race.season === table.season ? "  AFTER R" + table.round : "  FINAL")
  : "STANDINGS UNAVAILABLE";
const lead = list[0] ? Number(list[0].points) || 1 : 1;
const BAR_W = 104;
const HIDE = -200;
function row(i, y) {
  const s = list[i];
  if (!s) return { pos: "", code: "", name: "", pts: "", bw: 0, by: HIDE };
  const drv = s.Driver || {};
  const pts = Number(s.points) || 0;
  return {
    pos: s.positionText || s.position,
    code: ascii(drv.code || String(drv.familyName || "").slice(0, 3).toUpperCase()),
    name: fit(ascii(drv.familyName), W2, 94),
    pts: String(s.points),
    bw: Math.max(2, Math.round((BAR_W * pts) / lead)),
    by: y - 3,
  };
}
const a = row(0, 146), b = row(1, 166), c = row(2, 186), d = row(3, 206), e = row(4, 226);
export const r1_pos = a.pos, r1_code = a.code, r1_name = a.name, r1_pts = a.pts, r1_bw = a.bw, r1_by = a.by;
export const r2_pos = b.pos, r2_code = b.code, r2_name = b.name, r2_pts = b.pts, r2_bw = b.bw, r2_by = b.by;
export const r3_pos = c.pos, r3_code = c.code, r3_name = c.name, r3_pts = c.pts, r3_bw = c.bw, r3_by = c.by;
export const r4_pos = d.pos, r4_code = d.code, r4_name = d.name, r4_pts = d.pts, r4_bw = d.bw, r4_by = d.by;
export const r5_pos = e.pos, r5_code = e.code, r5_name = e.name, r5_pts = e.pts, r5_bw = e.bw, r5_by = e.by;
`;

const ROW_Y = [146, 166, 186, 206, 226];
const standingRows: RawWireOp[] = ROW_Y.flatMap((y, i): RawWireOp[] => {
  const n = i + 1;
  return [
    ["text", `{r${n}_pos}`, 18, y, 2, 1, "MR", "#8C97AB"],
    ["text", `{r${n}_code}`, 28, y, 2, 1, "ML", "#FFFFFF"],
    ["text", `{r${n}_name}`, 70, y, 2, 1, "ML", "#A8B3C7"],
    ["fillRect", 170, `{r${n}_by}`, `{r${n}_bw}`, 6, n === 1 ? "#E10600" : "#5A6375"],
    ["text", `{r${n}_pts}`, 312, y, 2, 1, "MR", "#FFFFFF"],
  ];
});

const wire: RawWireOp[] = [
  ["fillScreen", "#07080C"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A0A0C"],
  ["fillRect", 0, 24, 320, 2, "#E10600"],
  ["text", "{round}", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 12, 2, 1, "MR", "#A8B3C7"],
  // Next race
  ["text", "{title}", 8, 34, 4, 1, "TL", "#FFFFFF"],
  ["text", "{circuit}", 8, 64, 2, 1, "TL", "#8C97AB"],
  ["text", "{when}", 8, 98, 2, 1, "ML", "#D6DEEB"],
  ["text", "{count}", 312, 98, 4, 1, "MR", "#FF4A3D"],
  // Standings
  ["drawFastHLine", 8, 118, 304, "#262B36"],
  ["text", "{st_label}", 8, 129, 1, 1, "ML", "#FF4A3D"],
  ...standingRows,
];

const template: Template = {
  id: "f1-next-race",
  name: "F1 next race",
  description: "The next Formula 1 Grand Prix with its local start time and a countdown, plus the top 5 of the drivers' championship.",
  apis: ["Jolpica F1"],
  category: "sports",
  dataCode: code,
  rows: rows("f1-next-race", wire),
  sampleVars: {"circuit":"Las Vegas Strip Street Circuit, Las Vegas","clock":"01:08","count":"in 1d 13h","r1_bw":104,"r1_by":143,"r1_code":"ANT","r1_name":"Antonelli","r1_pos":"1","r1_pts":"390","r2_bw":74,"r2_by":163,"r2_code":"VER","r2_name":"Verstappen","r2_pos":"2","r2_pts":"279","r3_bw":70,"r3_by":183,"r3_code":"RUS","r3_name":"Russell","r3_pos":"3","r3_pts":"262","r4_bw":70,"r4_by":203,"r4_code":"HAM","r4_name":"Hamilton","r4_pos":"4","r4_pts":"261","r5_bw":66,"r5_by":223,"r5_code":"LEC","r5_name":"Leclerc","r5_pos":"5","r5_pts":"249","round":"F1  ROUND 21","st_label":"DRIVERS' CHAMPIONSHIP 2026  AFTER R20","title":"Las Vegas Grand Prix","when":"Sun 22 Nov  15:00"},
};

export default template;
