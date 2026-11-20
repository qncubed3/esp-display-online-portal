import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// AFL tips: Squiggle's aggregate (consensus of the computer models) tip for every game of the
// next round, with the tipped team highlighted, a confidence bar (50% to 100%) and the predicted margin.

const MAX = 9; // a home-and-away round has 9 games

const code = String.raw`// AFL tips from Squiggle (api.squiggle.com.au, free, no key; it asks for a User-Agent,
// which the sandbox sends). source=8 is "Aggregate": the consensus of all the models Squiggle tracks.
// Shows the next round that still has games to play, this season or the next one (the
// off-season usually has round 1 tips already). Games already played get a green or red dot.
// If nothing is left to tip, it shows how the tips went in the last round played.
const SOURCE = 8; // 8 = Aggregate; see https://api.squiggle.com.au/?q=sources for single models
const MAX = 9;
const TIP = "#FFC400", OTHER = "#8A8A8A", RIGHT = "#3DDC84", WRONG = "#FF5252";

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

let failed = false;
async function tips(year) {
  try {
    const d = await get("https://api.squiggle.com.au/?q=tips;year=" + year + ";source=" + SOURCE, { cache: 3600 });
    return d && Array.isArray(d.tips) ? d.tips : [];
  } catch (e) {
    console.log("afl-tips: " + e.message);
    failed = true;
    return [];
  }
}

const year = Number(now("YYYY"));
const open = (t) => t.correct === null || t.correct === undefined;
function nextRound(list) {
  const r = list.filter(open).map((t) => Number(t.round));
  return r.length ? Math.min.apply(null, r) : null;
}

let list = await tips(year);
let mode = "next";
let round = nextRound(list);
if (round === null) {
  const nxt = await tips(year + 1);
  const r2 = nextRound(nxt);
  if (r2 !== null) { list = nxt; round = r2; }
}
if (round === null) {
  // Nothing left to tip: show the last round played (this season, else last season).
  mode = "done";
  if (!list.length) list = await tips(year - 1);
  const r = list.map((t) => Number(t.round));
  round = r.length ? Math.max.apply(null, r) : null;
}

const shown = list
  .filter((t) => Number(t.round) === round)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.gameid - b.gameid)
  .slice(0, MAX);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parts(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
function day(s) { const d = parts(s); return d ? DAYS[d.getUTCDay()] : ""; }
function dmy(s) { const d = parts(s); return d ? d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] : ""; }

// Spread the rows over the screen: 9 games at 23 px, fewer games get more room.
const n = Math.max(1, shown.length);
const rowH = Math.min(40, Math.floor(208 / n));

function row(i) {
  const t = shown[i];
  if (!t) return { h: "", a: "", v: "", hc: OTHER, ac: OTHER, y: -200, by: -200, w: 0, pct: "", mg: "", day: "", dc: OTHER, dy: -200 };
  const conf = Math.max(0, Math.min(100, Number(t.confidence) || 0));
  const homeTip = t.tip === t.hteam;
  const done = !open(t);
  const margin = Math.round(Number(t.margin) || 0);
  const y = 28 + i * rowH + Math.floor(rowH / 2);
  return {
    h: abbr(t.hteam), a: abbr(t.ateam), v: "v",
    hc: homeTip ? TIP : OTHER, ac: homeTip ? OTHER : TIP,
    y: y, by: y - 4, w: Math.max(2, Math.round((conf - 50) * 2)), // bar: 50% (coin toss) to 100%
    pct: Math.round(conf) + "%",
    mg: margin > 0 ? "by " + margin : "even",
    day: done ? "" : day(t.date),
    dc: Number(t.correct) === 1 ? RIGHT : WRONG, dy: done ? y : -200,
  };
}
const R = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(row);
export const r1_h = R[0].h, r1_a = R[0].a, r1_v = R[0].v, r1_hc = R[0].hc, r1_ac = R[0].ac, r1_y = R[0].y, r1_w = R[0].w, r1_pct = R[0].pct, r1_mg = R[0].mg, r1_day = R[0].day, r1_dc = R[0].dc, r1_dy = R[0].dy, r1_by = R[0].by;
export const r2_h = R[1].h, r2_a = R[1].a, r2_v = R[1].v, r2_hc = R[1].hc, r2_ac = R[1].ac, r2_y = R[1].y, r2_w = R[1].w, r2_pct = R[1].pct, r2_mg = R[1].mg, r2_day = R[1].day, r2_dc = R[1].dc, r2_dy = R[1].dy, r2_by = R[1].by;
export const r3_h = R[2].h, r3_a = R[2].a, r3_v = R[2].v, r3_hc = R[2].hc, r3_ac = R[2].ac, r3_y = R[2].y, r3_w = R[2].w, r3_pct = R[2].pct, r3_mg = R[2].mg, r3_day = R[2].day, r3_dc = R[2].dc, r3_dy = R[2].dy, r3_by = R[2].by;
export const r4_h = R[3].h, r4_a = R[3].a, r4_v = R[3].v, r4_hc = R[3].hc, r4_ac = R[3].ac, r4_y = R[3].y, r4_w = R[3].w, r4_pct = R[3].pct, r4_mg = R[3].mg, r4_day = R[3].day, r4_dc = R[3].dc, r4_dy = R[3].dy, r4_by = R[3].by;
export const r5_h = R[4].h, r5_a = R[4].a, r5_v = R[4].v, r5_hc = R[4].hc, r5_ac = R[4].ac, r5_y = R[4].y, r5_w = R[4].w, r5_pct = R[4].pct, r5_mg = R[4].mg, r5_day = R[4].day, r5_dc = R[4].dc, r5_dy = R[4].dy, r5_by = R[4].by;
export const r6_h = R[5].h, r6_a = R[5].a, r6_v = R[5].v, r6_hc = R[5].hc, r6_ac = R[5].ac, r6_y = R[5].y, r6_w = R[5].w, r6_pct = R[5].pct, r6_mg = R[5].mg, r6_day = R[5].day, r6_dc = R[5].dc, r6_dy = R[5].dy, r6_by = R[5].by;
export const r7_h = R[6].h, r7_a = R[6].a, r7_v = R[6].v, r7_hc = R[6].hc, r7_ac = R[6].ac, r7_y = R[6].y, r7_w = R[6].w, r7_pct = R[6].pct, r7_mg = R[6].mg, r7_day = R[6].day, r7_dc = R[6].dc, r7_dy = R[6].dy, r7_by = R[6].by;
export const r8_h = R[7].h, r8_a = R[7].a, r8_v = R[7].v, r8_hc = R[7].hc, r8_ac = R[7].ac, r8_y = R[7].y, r8_w = R[7].w, r8_pct = R[7].pct, r8_mg = R[7].mg, r8_day = R[7].day, r8_dc = R[7].dc, r8_dy = R[7].dy, r8_by = R[7].by;
export const r9_h = R[8].h, r9_a = R[8].a, r9_v = R[8].v, r9_hc = R[8].hc, r9_ac = R[8].ac, r9_y = R[8].y, r9_w = R[8].w, r9_pct = R[8].pct, r9_mg = R[8].mg, r9_day = R[8].day, r9_dc = R[8].dc, r9_dy = R[8].dy, r9_by = R[8].by;

// Header: round name and season in the middle; on the right the record so far, or the start date.
const first = shown[0];
let label = "";
if (first) {
  const rn = Number(first.round);
  label = "Round " + rn + " " + first.year;
}
const played = shown.filter((t) => !open(t));
const right = played.filter((t) => Number(t.correct) === 1).length;
export const round_label = label;
export const info = played.length ? right + "/" + played.length + " right" : (first ? dmy(first.date) : "");
export const msg = shown.length ? "" : (failed ? "No data" : "No tips yet");
export const sub = shown.length ? "" : (failed ? "Squiggle unavailable" : "Check back closer to round 1");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#0A2440"],
  ["text", "AFL tips", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{round_label}", 160, 13, 2, 1, "MC", "#4FC3F7"],
  ["text", "{info}", 312, 13, 2, 1, "MR", "#D0D0D0"],
  ["text", "{msg}", 160, 120, 4, 1, "MC", "#FFFFFF"],
  ["text", "{sub}", 160, 148, 2, 1, "MC", "#8A8A8A"],
  ...Array.from({ length: MAX }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = `{r${n}_y}`;
    return [
      ["text", `{r${n}_h}`, 8, y, 2, 1, "ML", `{r${n}_hc}`],
      ["text", `{r${n}_v}`, 46, y, 2, 1, "MC", "#5A5A5A"],
      ["text", `{r${n}_a}`, 56, y, 2, 1, "ML", `{r${n}_ac}`],
      ["fillRect", 100, `{r${n}_by}`, 100, 8, "#1E2A38"],
      ["fillRect", 100, `{r${n}_by}`, `{r${n}_w}`, 8, "#FFC400"],
      ["text", `{r${n}_pct}`, 206, y, 2, 1, "ML", "#FFFFFF"],
      ["text", `{r${n}_day}`, 244, y, 1, 1, "ML", "#4FC3F7"],
      ["fillCircle", 252, `{r${n}_dy}`, 4, `{r${n}_dc}`],
      ["text", `{r${n}_mg}`, 312, y, 2, 1, "MR", "#D0D0D0"],
    ];
  }).flat(),
];

const template: Template = {
  id: "afl-tips",
  name: "AFL tips",
  description: "Squiggle's consensus tip for every game of the next AFL round: tipped team, confidence bar and predicted margin.",
  apis: ["Squiggle"],
  category: "sports",
  dataCode: code,
  rows: rows("afl-tips", wire),
  sampleVars: {"info":"17 Mar","msg":"","r1_a":"GEE","r1_ac":"#8A8A8A","r1_by":35,"r1_day":"Wed","r1_dc":"#FF5252","r1_dy":-200,"r1_h":"SYD","r1_hc":"#FFC400","r1_mg":"by 2","r1_pct":"53%","r1_v":"v","r1_w":5,"r1_y":39,"r2_a":"WBD","r2_ac":"#8A8A8A","r2_by":58,"r2_day":"Thu","r2_dc":"#FF5252","r2_dy":-200,"r2_h":"FRE","r2_hc":"#FFC400","r2_mg":"by 17","r2_pct":"68%","r2_v":"v","r2_w":36,"r2_y":62,"r3_a":"BRI","r3_ac":"#8A8A8A","r3_by":81,"r3_day":"Fri","r3_dc":"#FF5252","r3_dy":-200,"r3_h":"HAW","r3_hc":"#FFC400","r3_mg":"by 5","r3_pct":"57%","r3_v":"v","r3_w":13,"r3_y":85,"r4_a":"CAR","r4_ac":"#FFC400","r4_by":104,"r4_day":"Sat","r4_dc":"#FF5252","r4_dy":-200,"r4_h":"RIC","r4_hc":"#8A8A8A","r4_mg":"by 25","r4_pct":"77%","r4_v":"v","r4_w":53,"r4_y":108,"r5_a":"GWS","r5_ac":"#8A8A8A","r5_by":127,"r5_day":"Sat","r5_dc":"#FF5252","r5_dy":-200,"r5_h":"ADE","r5_hc":"#FFC400","r5_mg":"by 10","r5_pct":"64%","r5_v":"v","r5_w":27,"r5_y":131,"r6_a":"COL","r6_ac":"#FFC400","r6_by":150,"r6_day":"Sat","r6_dc":"#FF5252","r6_dy":-200,"r6_h":"STK","r6_hc":"#8A8A8A","r6_mg":"by 6","r6_pct":"58%","r6_v":"v","r6_w":16,"r6_y":154,"r7_a":"PTA","r7_ac":"#8A8A8A","r7_by":173,"r7_day":"Sun","r7_dc":"#FF5252","r7_dy":-200,"r7_h":"NTH","r7_hc":"#FFC400","r7_mg":"by 1","r7_pct":"53%","r7_v":"v","r7_w":6,"r7_y":177,"r8_a":"ESS","r8_ac":"#8A8A8A","r8_by":196,"r8_day":"Sun","r8_dc":"#FF5252","r8_dy":-200,"r8_h":"MEL","r8_hc":"#FFC400","r8_mg":"by 27","r8_pct":"77%","r8_v":"v","r8_w":55,"r8_y":200,"r9_a":"GCS","r9_ac":"#FFC400","r9_by":219,"r9_day":"Sun","r9_dc":"#FF5252","r9_dy":-200,"r9_h":"WCE","r9_hc":"#8A8A8A","r9_mg":"by 18","r9_pct":"67%","r9_v":"v","r9_w":33,"r9_y":223,"round_label":"Round 1 2027","sub":""},
};

export default template;
