import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Christmas countdown: big days-to-go between two drawn trees, fairy lights and snow,
// with the Christmas Day forecast once it is in range and the public holidays off.

const code = String.raw`// Days, hours and minutes until Christmas (midnight 25 Dec in the owner's timezone).
// Public holidays from Nager.Date and the Christmas Day forecast from Open-Meteo (both free, no key).
// The forecast appears once 25 Dec is within 16 days.
const COUNTRY = "AU";
const STATE = "AU-VIC"; // state holidays to include; "" for national only
const LAT = -37.81;
const LON = 144.96;
const HIDE = -200; // y for shapes that should not show

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Local wall-clock as if UTC" ms, so no timezone maths is needed.
const Y = Number(now("YYYY"));
const nowL = Date.parse(now("YYYY-MM-DD") + "T" + now("HH:mm:ss") + "Z");
const isXmas = now("MM") === "12" && now("DD") === "25";
const afterXmas = now("MM") === "12" && Number(now("DD")) > 25;
const XY = afterXmas ? Y + 1 : Y;
const target = Date.UTC(XY, 11, 25);
const xmasIso = XY + "-12-25";
const xd = new Date(target);

export const clock = now("ddd DD/MM HH:mm");

// Countdown (rounded up to the minute so it only reaches zero at midnight).
const mins = isXmas ? 0 : Math.max(0, Math.ceil((target - nowL) / 60000));
const d = Math.floor(mins / 1440);
const h = Math.floor((mins % 1440) / 60);
const m = mins % 60;
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
export const big = isXmas ? "" : d > 0 ? String(d) : String(h);
export const big_label = isXmas ? "" : d > 0 ? (d === 1 ? "DAY TO GO" : "DAYS TO GO") : h === 1 ? "HOUR TO GO" : "HOURS TO GO";
export const rest = isXmas ? "" : d > 0 ? plural(h, "hr") + " " + m + " min" : m + " min";
export const date_line = (DAYS[xd.getUTCDay()] + " 25 Dec " + XY).toUpperCase();
export const merry1 = isXmas ? "MERRY" : "";
export const merry2 = isXmas ? "CHRISTMAS!" : "";

// Public holidays between Christmas Eve and New Year's Eve, as days off.
let hols = "";
try {
  const list = await get("https://date.nager.at/api/v3/PublicHolidays/" + XY + "/" + COUNTRY, { cache: 86400 });
  const seen = {};
  const days = [];
  for (const x of list || []) {
    const ds = String(x.date || "");
    if (ds < XY + "-12-24" || ds > XY + "-12-31" || seen[ds]) continue;
    if (!(x.global || (STATE && (x.counties || []).indexOf(STATE) >= 0))) continue;
    seen[ds] = true;
    const t = new Date(Date.parse(ds + "T00:00:00Z"));
    days.push(DAYS[t.getUTCDay()] + " " + t.getUTCDate());
  }
  if (days.length) hols = "Days off: " + days.slice(0, 3).join(" + ") + " Dec";
} catch (e) {}
export const fc_sub = hols || "Christmas Day: " + DAYS[xd.getUTCDay()] + " 25 Dec";

// Christmas Day forecast, when it is within Open-Meteo's 16 days.
function describe(n) {
  if (n === 0) return "Sunny";
  if (n === 1) return "Mostly sunny";
  if (n === 2) return "Partly cloudy";
  if (n === 3) return "Cloudy";
  if (n === 45 || n === 48) return "Fog";
  if (n >= 51 && n <= 57) return "Drizzle";
  if (n >= 61 && n <= 67) return "Rain";
  if (n >= 71 && n <= 77) return "Snow";
  if (n >= 80 && n <= 82) return "Showers";
  if (n === 85 || n === 86) return "Snow showers";
  if (n >= 95) return "Storms";
  return "";
}
let hi = null;
let wc = null;
try {
  const daysOut = Math.floor((target - Date.UTC(Y, Number(now("MM")) - 1, Number(now("DD")))) / 86400000);
  if (daysOut <= 15) {
    const wx = await get(
      "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
        "&daily=temperature_2m_max,weather_code&forecast_days=16&timezone=auto",
      { cache: 3600 },
    );
    const i = (wx.daily.time || []).indexOf(xmasIso);
    if (i >= 0 && wx.daily.temperature_2m_max[i] != null) {
      hi = Math.round(wx.daily.temperature_2m_max[i]);
      wc = wx.daily.weather_code[i];
    }
  }
} catch (e) {}

const has = hi !== null;
let fcText;
if (has) {
  fcText = (isXmas ? "Today: " : "Christmas Day: ") + hi + "C " + describe(wc);
} else {
  const from = new Date(target - 15 * 86400000);
  fcText = "Forecast from " + DAYS[from.getUTCDay()] + " " + from.getUTCDate() + " " + MONTHS[from.getUTCMonth()];
}
export const fc_text = fcText;

// Panel icon: weather when there is a forecast, otherwise a gift.
const drops = has && ((wc >= 51 && wc <= 67) || (wc >= 71 && wc <= 86) || wc >= 95);
const sunny = has && wc <= 1;
export const ic_sun_y = sunny ? 211 : HIDE;
export const ic_c1_y = has && !sunny ? (drops ? 206 : 212) : HIDE;
export const ic_c2_y = has && !sunny ? (drops ? 203 : 209) : HIDE;
export const ic_c3_y = has && !sunny ? (drops ? 205 : 211) : HIDE;
export const ic_drop_y = drops ? 219 : HIDE;
export const ic_drop = wc >= 95 ? "#FFE040" : wc >= 71 && wc <= 86 && !(wc >= 80 && wc <= 82) ? "#FFFFFF" : "#40C8FF";
export const gift_y = has ? HIDE : 205;
export const gift_lid_y = has ? HIDE : 200;
export const gift_rib_y = has ? HIDE : 200;
export const gift_bow_y = has ? HIDE : 198;
`;

const RED = "#C0141E";
const GOLD = "#FFD24A";
const TREE = "#1E8C3A";
const TREE_DARK = "#167030";
const BG = "#082A18";
const SNOW = "#E8F0FF";

// A layered triangle tree centred on cx with a star, baubles and a trunk.
function tree(cx: number): RawWireOp[] {
  return [
    ["fillRect", cx - 6, 162, 12, 16, "#7A4A22"],
    ["fillTriangle", cx, 112, cx - 36, 166, cx + 36, 166, TREE_DARK],
    ["fillTriangle", cx, 86, cx - 30, 132, cx + 30, 132, TREE],
    ["fillTriangle", cx, 62, cx - 22, 100, cx + 22, 100, TREE],
    ["fillTriangle", cx, 50, cx - 7, 62, cx + 7, 62, GOLD],
    ["fillTriangle", cx, 66, cx - 7, 54, cx + 7, 54, GOLD],
    ["fillCircle", cx - 8, 92, 3, RED],
    ["fillCircle", cx + 10, 120, 3, GOLD],
    ["fillCircle", cx - 14, 126, 3, "#40A0FF"],
    ["fillCircle", cx + 6, 104, 3, "#FF80C0"],
    ["fillCircle", cx + 20, 158, 3, RED],
    ["fillCircle", cx - 20, 154, 3, GOLD],
    ["fillCircle", cx, 146, 3, "#40A0FF"],
  ];
}

const LIGHTS = ["#FF4040", GOLD, "#40D060", "#40A0FF", "#FF80C0"];
const lights: RawWireOp[] = [["drawFastHLine", 0, 30, 320, "#355A40"]];
for (let i = 0; i < 15; i++) {
  const x = 10 + i * 21.4;
  lights.push(["fillCircle", Math.round(x), 35, 3, LIGHTS[i % LIGHTS.length]]);
}

const SNOWFLAKES: [number, number][] = [
  [96, 48], [132, 58], [214, 46], [248, 62], [176, 52], [8, 70], [312, 84], [82, 150],
  [238, 146], [6, 182], [314, 176], [88, 64], [226, 176], [96, 182], [72, 112], [250, 104],
];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 27, RED],
  ["text", "CHRISTMAS", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFE0E0"],
  ...lights,
  ...SNOWFLAKES.map(([x, y]): RawWireOp => ["fillCircle", x, y, 1, SNOW]),
  ...tree(40),
  ...tree(280),
  // Countdown
  ["text", "{big}", 160, 90, 4, 3, "MC", GOLD],
  ["text", "{big_label}", 160, 141, 2, 1, "MC", "#FFFFFF"],
  ["text", "{rest}", 160, 158, 2, 1, "MC", "#A8E0B4"],
  ["text", "{date_line}", 160, 176, 1, 1, "MC", "#80B090"],
  // Christmas Day
  ["text", "{merry1}", 160, 88, 4, 2, "MC", GOLD],
  ["text", "{merry2}", 160, 134, 4, 1, "MC", "#FFFFFF"],
  // Bottom panel
  ["fillRoundRect", 8, 190, 304, 42, 6, "#04200F"],
  ["drawRoundRect", 8, 190, 304, 42, 6, "#2F6B45"],
  ["fillCircle", 31, "{ic_sun_y}", 9, "#FFC800"],
  ["fillCircle", 26, "{ic_c1_y}", 6, "#D8D8D8"],
  ["fillCircle", 35, "{ic_c2_y}", 8, "#D8D8D8"],
  ["fillRoundRect", 18, "{ic_c3_y}", 28, 9, 4, "#D8D8D8"],
  ["fillRect", 22, "{ic_drop_y}", 2, 7, "{ic_drop}"],
  ["fillRect", 31, "{ic_drop_y}", 2, 7, "{ic_drop}"],
  ["fillRect", 40, "{ic_drop_y}", 2, 7, "{ic_drop}"],
  ["fillRect", 19, "{gift_y}", 26, 21, RED],
  ["fillRect", 17, "{gift_lid_y}", 30, 7, "#E03844"],
  ["fillRect", 30, "{gift_rib_y}", 4, 26, GOLD],
  ["fillCircle", 28, "{gift_bow_y}", 3, GOLD],
  ["fillCircle", 36, "{gift_bow_y}", 3, GOLD],
  ["text", "{fc_text}", 56, 196, 2, 1, "TL", "#FFFFFF"],
  ["text", "{fc_sub}", 56, 216, 1, 1, "TL", "#A8C8B0"],
];

const template: Template = {
  id: "christmas-countdown",
  name: "Christmas countdown",
  description: "Festive countdown to Christmas Day with drawn trees and lights, the days off, and the Christmas Day forecast once it's in range.",
  apis: ["Nager.Date", "Open-Meteo"],
  category: "clocks",
  dataCode: code,
  rows: rows("christmas-countdown", wire),
  sampleVars: {"big":"33","big_label":"DAYS TO GO","clock":"Sat 21/11 01:17","date_line":"FRI 25 DEC 2026","fc_sub":"Days off: Fri 25 + Mon 28 Dec","fc_text":"Forecast from Thu 10 Dec","gift_bow_y":198,"gift_lid_y":200,"gift_rib_y":200,"gift_y":205,"ic_c1_y":-200,"ic_c2_y":-200,"ic_c3_y":-200,"ic_drop":"#40C8FF","ic_drop_y":-200,"ic_sun_y":-200,"merry1":"","merry2":"","rest":"22 hrs 43 min"},
};

export default template;
