import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Golden hour for photographers: countdown to the next golden hour, a day timeline
// (twilight, blue hour, golden hour, day) with a "now" marker, and morning/evening windows.

const code = String.raw`// Golden and blue hour times from SunriseSunset.io (free, no key).
// Set PLACE, LAT, LON and TZ for your location; now() should use the same timezone.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";

const BAR_X = 10; // the timeline runs from about first light (left) to last light (right)
const BAR_W = 300;

export const clock = now("HH:mm");
export const place = PLACE;
const nowMin = Number(now("HH")) * 60 + Number(now("mm"));

// "5:37:03 AM" -> minutes after local midnight (null if missing)
function mins(s) {
  const m = /^(\d+):(\d+):(\d+)\s*(AM|PM)$/i.exec(String(s || "").trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[4].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]) + (Number(m[3]) >= 30 ? 1 : 0);
}
const pad = (n) => (n < 10 ? "0" : "") + n;
const hhmm = (m) => (m === null ? "--:--" : pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60));
const span = (m) => (m >= 60 ? Math.floor(m / 60) + "h " + pad(m % 60) + "m" : m + "m");

let r = null;
try {
  const res = await get(
    "https://api.sunrisesunset.io/json?lat=" + LAT + "&lng=" + LON + "&timezone=" + TZ + "&date=" + now("YYYY-MM-DD"),
    { cache: 21600 },
  );
  if (res.status !== "OK") throw new Error("status " + res.status);
  r = res.results;
} catch (e) {
  console.log("sunrisesunset.io failed:", e.message);
}
const g = (o, k) => (r && r[o] ? mins(r[o][k]) : null);
const gmB = g("golden_hour_morning", "begin"), gmE = g("golden_hour_morning", "end");
const geB = g("golden_hour_evening", "begin"), geE = g("golden_hour_evening", "end");
const bmB = g("blue_hour_morning", "begin"), bmE = g("blue_hour_morning", "end");
const beB = g("blue_hour_evening", "begin"), beE = g("blue_hour_evening", "end");
const rise = r ? mins(r.sunrise) : null, set = r ? mins(r.sunset) : null;
const fl = r ? mins(r.first_light) : null, ll = r ? mins(r.last_light) : null;
const ok = gmB !== null && gmE !== null && geB !== null && geE !== null;

// Morning and evening cards
export const m_gold = ok ? hhmm(gmB) + " - " + hhmm(gmE) : "--:--";
export const e_gold = ok ? hhmm(geB) + " - " + hhmm(geE) : "--:--";
export const m_blue = bmB !== null && bmE !== null ? hhmm(bmB) + " - " + hhmm(bmE) : "--:--";
export const e_blue = beB !== null && beE !== null ? hhmm(beB) + " - " + hhmm(beE) : "--:--";
export const m_sun = hhmm(rise);
export const e_sun = hhmm(set);

// Next golden hour (tomorrow morning is taken as today's morning times; they shift < 1 min/day)
let label = "NEXT GOLDEN HOUR", big = "--:--", away = "", sub = "No sun data";
let col = "#FFB030";
if (ok) {
  if (nowMin < gmB) { big = hhmm(gmB); away = "in " + span(gmB - nowMin); sub = "Morning, ends " + hhmm(gmE); }
  else if (nowMin < gmE) { label = "GOLDEN HOUR NOW"; big = hhmm(gmE); away = span(gmE - nowMin) + " left"; sub = "Morning light, ends"; col = "#FFD040"; }
  else if (nowMin < geB) { big = hhmm(geB); away = "in " + span(geB - nowMin); sub = "Evening, ends " + hhmm(geE); }
  else if (nowMin < geE) { label = "GOLDEN HOUR NOW"; big = hhmm(geE); away = span(geE - nowMin) + " left"; sub = "Evening light, ends"; col = "#FFD040"; }
  else { big = hhmm(gmB); away = "in " + span(gmB + 1440 - nowMin); sub = "Tomorrow, ends " + hhmm(gmE); }
}
export const next_label = label;
export const next_time = big;
export const next_in = away;
export const next_sub = sub;
export const next_col = col;

// Timeline from the hour before first light to the hour after last light
const t0 = ok ? Math.floor(((fl !== null ? fl : gmB - 90) - 30) / 60) * 60 : 240;
const t1 = ok ? Math.ceil(((ll !== null ? ll : geE + 90) + 30) / 60) * 60 : 1320;
const px = (m) => Math.round(BAR_X + (BAR_W * (Math.min(Math.max(m, t0), t1) - t0)) / (t1 - t0));
function seg(a, b) { return a === null || b === null || !ok ? [BAR_X, 0] : [px(a), Math.max(0, px(b) - px(a))]; }
const segs = {
  tw1: seg(fl, bmB !== null ? bmB : gmB), bl1: seg(bmB, bmE), go1: seg(gmB, gmE), day: seg(gmE, geB),
  go2: seg(geB, geE), bl2: seg(beB, beE), tw2: seg(beE !== null ? beE : geE, ll),
};
export const tw1_x = segs.tw1[0]; export const tw1_w = segs.tw1[1];
export const bl1_x = segs.bl1[0]; export const bl1_w = segs.bl1[1];
export const go1_x = segs.go1[0]; export const go1_w = segs.go1[1];
export const day_x = segs.day[0]; export const day_w = segs.day[1];
export const go2_x = segs.go2[0]; export const go2_w = segs.go2[1];
export const bl2_x = segs.bl2[0]; export const bl2_w = segs.bl2[1];
export const tw2_x = segs.tw2[0]; export const tw2_w = segs.tw2[1];
const inBar = ok && nowMin >= t0 && nowMin <= t1;
export const now_x = inBar ? px(nowMin) : -50;
export const now_l = now_x - 5;
export const now_r = now_x + 5;

// Hour ticks every 3 hours that fall inside the timeline
const tick = (h) => ok && h * 60 > t0 && h * 60 < t1;
export const k3_x = tick(3) ? px(180) : -50; export const k3 = tick(3) ? "03" : "";
export const k6_x = tick(6) ? px(360) : -50; export const k6 = tick(6) ? "06" : "";
export const k9_x = tick(9) ? px(540) : -50; export const k9 = tick(9) ? "09" : "";
export const k12_x = tick(12) ? px(720) : -50; export const k12 = tick(12) ? "12" : "";
export const k15_x = tick(15) ? px(900) : -50; export const k15 = tick(15) ? "15" : "";
export const k18_x = tick(18) ? px(1080) : -50; export const k18 = tick(18) ? "18" : "";
export const k21_x = tick(21) ? px(1260) : -50; export const k21 = tick(21) ? "21" : "";
`;

const BG = "#06080F";
const CARD = "#161C2C";
const LABEL = "#8A96AE";
const GOLD = "#FFB030";
const BLUE = "#5A8CFF";
const tickOps = (k: string): RawWireOp[] => [
  ["drawFastVLine", `{${k}_x}`, 129, 4, "#5A6478"],
  ["text", `{${k}}`, `{${k}_x}`, 135, 1, 1, "TC", LABEL],
];
const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 26, "#2A1A08"],
  ["text", "GOLDEN HOUR", 8, 13, 2, 1, "ML", GOLD],
  ["text", "{place}", 112, 13, 2, 1, "ML", "#C8B8A0"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#FFFFFF"],
  // Next golden hour
  ["text", "{next_label}", 10, 32, 2, 1, "TL", "{next_col}"],
  ["text", "{next_time}", 8, 50, 4, 2, "TL", "#FFFFFF"],
  ["text", "{next_in}", 310, 54, 4, 1, "TR", "{next_col}"],
  ["text", "{next_sub}", 310, 84, 2, 1, "TR", LABEL],
  // Timeline: night, twilight, blue hour, golden hour, day
  ["fillRect", 10, 114, 300, 14, "#10162A"],
  ["fillRect", "{tw1_x}", 114, "{tw1_w}", 14, "#24305A"],
  ["fillRect", "{tw2_x}", 114, "{tw2_w}", 14, "#24305A"],
  ["fillRect", "{bl1_x}", 114, "{bl1_w}", 14, BLUE],
  ["fillRect", "{bl2_x}", 114, "{bl2_w}", 14, BLUE],
  ["fillRect", "{day_x}", 114, "{day_w}", 14, "#8CC8F0"],
  ["fillRect", "{go1_x}", 114, "{go1_w}", 14, GOLD],
  ["fillRect", "{go2_x}", 114, "{go2_w}", 14, GOLD],
  ...tickOps("k3"), ...tickOps("k6"), ...tickOps("k9"), ...tickOps("k12"),
  ...tickOps("k15"), ...tickOps("k18"), ...tickOps("k21"),
  // Now marker
  ["fillTriangle", "{now_l}", 104, "{now_r}", 104, "{now_x}", 111, "#FFFFFF"],
  ["drawFastVLine", "{now_x}", 110, 22, "#FFFFFF"],
  // Morning and evening windows
  ["fillRoundRect", 6, 148, 151, 86, 6, CARD],
  ["fillRoundRect", 163, 148, 151, 86, 6, CARD],
  ["text", "MORNING", 14, 156, 1, 1, "TL", LABEL],
  ["text", "EVENING", 171, 156, 1, 1, "TL", LABEL],
  ["text", "Gold", 14, 170, 2, 1, "TL", GOLD],
  ["text", "{m_gold}", 150, 170, 2, 1, "TR", "#FFFFFF"],
  ["text", "Blue", 14, 190, 2, 1, "TL", BLUE],
  ["text", "{m_blue}", 150, 190, 2, 1, "TR", "#FFFFFF"],
  ["text", "Rise", 14, 210, 2, 1, "TL", LABEL],
  ["text", "{m_sun}", 150, 210, 2, 1, "TR", "#FFFFFF"],
  ["text", "Gold", 171, 170, 2, 1, "TL", GOLD],
  ["text", "{e_gold}", 307, 170, 2, 1, "TR", "#FFFFFF"],
  ["text", "Blue", 171, 190, 2, 1, "TL", BLUE],
  ["text", "{e_blue}", 307, 190, 2, 1, "TR", "#FFFFFF"],
  ["text", "Set", 171, 210, 2, 1, "TL", LABEL],
  ["text", "{e_sun}", 307, 210, 2, 1, "TR", "#FFFFFF"],
];

const template: Template = {
  id: "golden-hour",
  name: "Golden hour",
  description: "Countdown to the next golden hour, a day timeline of twilight, blue hour and golden hour, and today's morning and evening light windows.",
  apis: ["SunriseSunset.io", "now()"],
  category: "space",
  dataCode: code,
  rows: rows("golden-hour", wire),
  sampleVars: {"bl1_w":3,"bl1_x":47,"bl2_w":3,"bl2_x":274,"clock":"14:15","day_w":197,"day_x":63,"e_blue":"20:34 - 20:46","e_gold":"19:38 - 20:34","e_sun":"20:16","go1_w":13,"go1_x":50,"go2_w":14,"go2_x":260,"k12":"12","k12_x":145,"k15":"15","k15_x":190,"k18":"18","k18_x":235,"k21":"21","k21_x":280,"k3":"","k3_x":-50,"k6":"06","k6_x":55,"k9":"09","k9_x":100,"m_blue":"05:26 - 05:38","m_gold":"05:38 - 06:33","m_sun":"05:56","next_col":"#FFB030","next_in":"in 5h 23m","next_label":"NEXT GOLDEN HOUR","next_sub":"Evening, ends 20:34","next_time":"19:38","now_l":174,"now_r":184,"now_x":179,"place":"MELBOURNE","tw1_w":20,"tw1_x":27,"tw2_w":19,"tw2_x":277},
};

export default template;
