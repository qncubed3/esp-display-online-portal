import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// 5-day forecast: header with the city and current temperature, then five day cards, each with
// the day name, an icon (sun / cloud / rain / storm), max and min temperature and rain chance.
//
// Every card draws all four icons; Data hides three of them. Each icon's y coordinates are
// written as "{ic_<icon><day>}NN", and Data sets that variable to "" for the icon to show
// (y = NN) or "-" for the others (y = -NN, above the screen). One variable per icon per day.

const forecastCode = String.raw`// 5-day forecast from Open-Meteo (free, no key).
// Set PLACE, LAT and LON to your location (and TZ to its timezone).
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia%2FMelbourne";

let wx = null;
try {
  wx = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=" + TZ + "&forecast_days=5",
    { cache: 1800 },
  );
} catch (e) {
  console.log("forecast failed:", e.message);
}
const ok = !!(wx && wx.daily && wx.daily.time && wx.daily.time.length >= 5);

export const place = PLACE;
export const now_temp = ok && wx.current ? wx.current.temperature_2m.toFixed(1) : "--";
export const msg = ok ? "" : "Forecast unavailable";
// Same switch for the degree rings and rain drops: "-" moves them above the screen.
export const hide = ok ? "" : "-";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function day(i) {
  if (!ok) return { name: "", hi: "", lo: "", rain: "", rc: "#000000", icon: "" };
  const d = wx.daily;
  const [y, m, dd] = d.time[i].split("-").map(Number);
  const code = d.weather_code[i];
  const p = d.precipitation_probability_max[i];
  return {
    name: DAYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()],
    hi: String(Math.round(d.temperature_2m_max[i])),
    lo: String(Math.round(d.temperature_2m_min[i])),
    rain: p == null ? "--" : p + "%",
    rc: p == null || p < 30 ? "#6A8CA8" : "#00C8FF", // dim when rain is unlikely
    // WMO codes: 0-1 clear, 2-3 / 45-48 cloud, 51-86 drizzle, rain, snow, showers, 95+ storm
    icon: code <= 1 ? "sun" : code >= 95 ? "storm" : code >= 51 ? "rain" : "cloud",
  };
}
const D = [0, 1, 2, 3, 4].map(day);
const show = (i, icon) => (D[i].icon === icon ? "" : "-");

export const d0 = D[0].name, d1 = D[1].name, d2 = D[2].name, d3 = D[3].name, d4 = D[4].name;
export const hi0 = D[0].hi, hi1 = D[1].hi, hi2 = D[2].hi, hi3 = D[3].hi, hi4 = D[4].hi;
export const lo0 = D[0].lo, lo1 = D[1].lo, lo2 = D[2].lo, lo3 = D[3].lo, lo4 = D[4].lo;
export const rain0 = D[0].rain, rain1 = D[1].rain, rain2 = D[2].rain, rain3 = D[3].rain, rain4 = D[4].rain;
export const rc0 = D[0].rc, rc1 = D[1].rc, rc2 = D[2].rc, rc3 = D[3].rc, rc4 = D[4].rc;
// Icon switches: "" shows the icon, "-" moves it above the screen.
export const ic_sun0 = show(0, "sun"), ic_sun1 = show(1, "sun"), ic_sun2 = show(2, "sun"), ic_sun3 = show(3, "sun"), ic_sun4 = show(4, "sun");
export const ic_cloud0 = show(0, "cloud"), ic_cloud1 = show(1, "cloud"), ic_cloud2 = show(2, "cloud"), ic_cloud3 = show(3, "cloud"), ic_cloud4 = show(4, "cloud");
export const ic_rain0 = show(0, "rain"), ic_rain1 = show(1, "rain"), ic_rain2 = show(2, "rain"), ic_rain3 = show(3, "rain"), ic_rain4 = show(4, "rain");
export const ic_storm0 = show(0, "storm"), ic_storm1 = show(1, "storm"), ic_storm2 = show(2, "storm"), ic_storm3 = show(3, "storm"), ic_storm4 = show(4, "storm");
`;

const CARD = "#142233";
const TODAY_CARD = "#1E3A5A";
const HI = "#FFA040";
const LO = "#70B8FF";
const SUN = "#FFD000";
const CLOUD = "#E8ECF0";
const RAIN_CLOUD = "#A8B4C0";
const STORM_CLOUD = "#78828C";
const DROP = "#00C8FF";
const ICON_Y = 100; // icon centre

// The four icons for day i, centred on (cx, ICON_Y). `y(n)` is n px below the centre, behind the
// day's switch variable for that icon.
function icons(i: number, cx: number): RawWireOp[] {
  const at = (icon: string) => (n: number) => `{ic_${icon}${i}}${ICON_Y + n}`;
  const s = at("sun"), c = at("cloud"), r = at("rain"), t = at("storm");
  return [
    // sun: disc and eight rays
    ["fillCircle", cx, s(0), 11, SUN],
    ["fillRect", cx - 1, s(-21), 3, 6, SUN],
    ["fillRect", cx - 1, s(16), 3, 6, SUN],
    ["fillRect", cx - 21, s(-1), 6, 3, SUN],
    ["fillRect", cx + 16, s(-1), 6, 3, SUN],
    ["fillTriangle", cx - 16, s(-16), cx - 10, s(-13), cx - 13, s(-10), SUN],
    ["fillTriangle", cx + 16, s(-16), cx + 10, s(-13), cx + 13, s(-10), SUN],
    ["fillTriangle", cx - 16, s(16), cx - 10, s(13), cx - 13, s(10), SUN],
    ["fillTriangle", cx + 16, s(16), cx + 10, s(13), cx + 13, s(10), SUN],
    // cloud
    ["fillCircle", cx - 9, c(3), 9, CLOUD],
    ["fillCircle", cx + 3, c(-3), 12, CLOUD],
    ["fillCircle", cx + 13, c(5), 8, CLOUD],
    ["fillRoundRect", cx - 19, c(4), 40, 11, 5, CLOUD],
    // rain: cloud with three slanted drops
    ["fillCircle", cx - 9, r(-6), 8, RAIN_CLOUD],
    ["fillCircle", cx + 3, r(-11), 11, RAIN_CLOUD],
    ["fillCircle", cx + 13, r(-4), 7, RAIN_CLOUD],
    ["fillRoundRect", cx - 18, r(-5), 38, 10, 5, RAIN_CLOUD],
    ["fillTriangle", cx - 8, r(9), cx - 5, r(9), cx - 12, r(20), DROP],
    ["fillTriangle", cx + 2, r(9), cx + 5, r(9), cx - 2, r(20), DROP],
    ["fillTriangle", cx + 12, r(9), cx + 15, r(9), cx + 8, r(20), DROP],
    // storm: dark cloud with a lightning bolt
    ["fillCircle", cx - 9, t(-6), 8, STORM_CLOUD],
    ["fillCircle", cx + 3, t(-11), 11, STORM_CLOUD],
    ["fillCircle", cx + 13, t(-4), 7, STORM_CLOUD],
    ["fillRoundRect", cx - 18, t(-5), 38, 10, 5, STORM_CLOUD],
    ["fillTriangle", cx + 3, t(3), cx - 7, t(15), cx + 1, t(15), SUN],
    ["fillTriangle", cx - 1, t(12), cx + 7, t(12), cx - 5, t(24), SUN],
  ];
}

function dayCard(i: number): RawWireOp[] {
  const x = 2 + i * 64; // card left; cards are 60 wide with 4 px gaps
  const cx = x + 30;
  return [
    ["fillRoundRect", x, 40, 60, 198, 6, i === 0 ? TODAY_CARD : CARD],
    ["text", `{d${i}}`, cx, 46, 4, 1, "TC", "#FFFFFF"],
    ...icons(i, cx),
    // Max and min, right-aligned so the degree rings line up across the cards
    ["text", `{hi${i}}`, cx + 8, 134, 4, 1, "TR", HI],
    ["drawCircle", cx + 13, "{hide}138", 3, HI],
    ["drawCircle", cx + 13, "{hide}138", 2, HI],
    ["text", `{lo${i}}`, cx + 8, 168, 4, 1, "TR", LO],
    ["drawCircle", cx + 13, "{hide}172", 3, LO],
    ["drawCircle", cx + 13, "{hide}172", 2, LO],
    // Rain chance with a drop
    ["fillCircle", cx - 15, "{hide}217", 4, `{rc${i}}`],
    ["fillTriangle", cx - 19, "{hide}216", cx - 11, "{hide}216", cx - 15, "{hide}208", `{rc${i}}`],
    ["text", `{rain${i}}`, cx - 8, 215, 2, 1, "ML", `{rc${i}}`],
  ];
}

const forecastWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header: city, current temperature
  ["fillRect", 0, 0, 320, 36, "#003366"],
  ["text", "{place}", 8, 18, 4, 1, "ML", "#FFFFFF"],
  ["text", "NOW", 222, 18, 2, 1, "MR", "#A0B4C8"],
  ["text", "{now_temp}", 284, 18, 4, 1, "MR", "#FFD040"],
  ["drawCircle", 290, 11, 3, "#FFD040"],
  ["drawCircle", 290, 11, 2, "#FFD040"],
  ["text", "C", 312, 18, 4, 1, "MR", "#FFD040"],
  ...[0, 1, 2, 3, 4].flatMap(dayCard),
  // Shown only when the forecast couldn't be fetched
  ["text", "{msg}", 160, 120, 4, 1, "MC", "#FFFFFF"],
];

const template: Template = {
  id: "forecast-5-day",
  name: "5-Day Forecast",
  description: "Five day cards for Melbourne with weather icons, max and min temperatures and rain chance, plus the current temperature.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: forecastCode,
  rows: rows("forecast-5-day", forecastWire),
  sampleVars: {"d0": "Sat", "d1": "Sun", "d2": "Mon", "d3": "Tue", "d4": "Wed", "hi0": "24", "hi1": "31", "hi2": "22", "hi3": "17", "hi4": "25", "hide": "", "ic_cloud0": "-", "ic_cloud1": "-", "ic_cloud2": "", "ic_cloud3": "-", "ic_cloud4": "", "ic_rain0": "", "ic_rain1": "", "ic_rain2": "-", "ic_rain3": "-", "ic_rain4": "-", "ic_storm0": "-", "ic_storm1": "-", "ic_storm2": "-", "ic_storm3": "-", "ic_storm4": "-", "ic_sun0": "-", "ic_sun1": "-", "ic_sun2": "-", "ic_sun3": "", "ic_sun4": "-", "lo0": "17", "lo1": "15", "lo2": "12", "lo3": "10", "lo4": "9", "msg": "", "now_temp": "19.5", "place": "MELBOURNE", "rain0": "76%", "rain1": "73%", "rain2": "60%", "rain3": "2%", "rain4": "0%", "rc0": "#00C8FF", "rc1": "#00C8FF", "rc2": "#00C8FF", "rc3": "#6A8CA8", "rc4": "#6A8CA8"},
};

export default template;
