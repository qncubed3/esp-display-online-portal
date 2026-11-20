import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// The next 12 hours: a temperature line with a dot per hour, rain-chance bars on the same x axis.

const N = 12; // hours shown (keep in step with Data)
const X0 = 40; // x of the first hour
const STEP = 24; // px between hours
const TY0 = 62, TY1 = 138; // temperature chart top and bottom
const RBASE = 200, RH = 40; // rain bars: baseline and height at 100%

const baseCode = String.raw`// Hourly temperature and chance of rain for the next 12 hours from Open-Meteo (free, no key).
// Set PLACE, LAT, LON and TZ for your location.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";

const N = 12;
const X0 = 40, STEP = 24; // keep in step with Draw
const TY0 = 62, TY1 = 138;
const RBASE = 200, RH = 40;
const HIDE = -200;

const WMO = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
  51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 56: "Icy drizzle", 57: "Icy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Icy rain", 67: "Icy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Showers", 81: "Showers", 82: "Heavy showers", 85: "Snow showers", 86: "Snow showers",
  95: "Storm", 96: "Storm, hail", 99: "Storm, hail",
};

let r = null;
try {
  r = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,weather_code&hourly=temperature_2m,precipitation_probability" +
      "&forecast_hours=" + N + "&timezone=" + encodeURIComponent(TZ),
    { cache: 1800 },
  );
} catch (e) {
  console.log("open-meteo failed:", e.message);
}

const cur = r && r.current;
const h = r && r.hourly;
const pts = []; // { t, temp, p }
if (h && h.time && h.temperature_2m) {
  for (let i = 0; i < h.time.length && pts.length < N; i++) {
    if (h.temperature_2m[i] == null) break;
    const p = h.precipitation_probability ? h.precipitation_probability[i] : null;
    pts.push({ t: h.time[i], temp: h.temperature_2m[i], p: p });
  }
}
const ok = pts.length >= 2;

export const place = PLACE;
export const clock = now("HH:mm");
export const temp = cur && cur.temperature_2m != null ? Math.round(cur.temperature_2m) + "C" : "--";
export const cond = cur && cur.weather_code != null ? WMO[cur.weather_code] || "" : "No data";

const temps = pts.map((x) => x.temp);
const tMax = ok ? Math.max.apply(null, temps) : 0;
const tMin = ok ? Math.min.apply(null, temps) : 0;
export const max_t = ok ? "Max " + Math.round(tMax) + "C" : "";
export const min_t = ok ? "Min " + Math.round(tMin) + "C" : "";

// Scale: whole degrees, at least 2 degrees of range
let hi = Math.ceil(tMax), lo = Math.floor(tMin);
if (hi - lo < 2) { hi += 1; lo = hi - 2; }
export const y_hi = ok ? hi + "C" : "";
export const y_lo = ok ? lo + "C" : "";
export const title = ok ? "Next " + pts.length + " hours" : "Forecast unavailable";

const px = (i) => X0 + i * STEP;
const py = (v) => Math.round(TY1 - ((TY1 - TY0) * (v - lo)) / (hi - lo));
const hhmm = (t) => t.slice(11, 16);
`;

// Data can't export from a loop, so the per-hour exports are generated here.
const hourExports = Array.from({ length: N }, (_, i) =>
  [
    `const q${i} = pts[${i}];`,
    `export const dy${i} = ok && q${i} ? py(q${i}.temp) : HIDE;`,
    `const rh${i} = ok && q${i} && q${i}.p != null ? Math.max(1, Math.round((q${i}.p / 100) * RH)) : 0;`,
    `export const ry${i} = rh${i} > 0 ? RBASE - rh${i} : HIDE;`,
    `export const rh_${i} = rh${i};`,
    `export const rp${i} = ok && q${i} && q${i}.p != null ? String(q${i}.p) : "";`,
    `export const rpy${i} = rh${i} > 0 ? RBASE - rh${i} - 2 : HIDE;`,
  ].join("\n"),
).join("\n");

const segExports = Array.from({ length: N - 1 }, (_, i) =>
  [
    `const sv${i} = ok && pts[${i + 1}];`,
    `export const sy${i}a = sv${i} ? dy${i} : HIDE;`,
    `export const sy${i}b = sv${i} ? dy${i + 1} : HIDE;`,
  ].join("\n"),
).join("\n");

const labelExports = [0, 3, 6, 9]
  .map((i) => `export const h${i} = ok && pts[${i}] ? hhmm(pts[${i}].t) : "";`)
  .join("\n");

const code = baseCode + hourExports + "\n" + segExports + "\n" + labelExports + "\n";

const HEAD = "#0C1A33";
const LABEL = "#8A9BB0";
const GRID = "#1C2836";
const LINE = "#FFB040";
const BAR = "#3A7FD0";

const px = (i: number) => X0 + i * STEP;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header: current temperature and conditions, place and time, max and min for the period
  ["fillRect", 0, 0, 320, 44, HEAD],
  ["text", "{temp}", 8, 22, 4, 1, "ML", "#FFFFFF"],
  ["text", "{cond}", 70, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{place}", 70, 32, 1, 1, "ML", LABEL],
  ["text", "{clock}", 130, 32, 1, 1, "ML", LABEL],
  ["text", "{max_t}", 312, 13, 2, 1, "MR", LINE],
  ["text", "{min_t}", 312, 31, 2, 1, "MR", "#7FC4FF"],
  // Temperature chart frame
  ["text", "{title}", X0 - 6, 47, 1, 1, "TL", LABEL],
  ["drawFastHLine", X0 - 6, TY0, px(N - 1) - X0 + 12, GRID],
  ["drawFastHLine", X0 - 6, (TY0 + TY1) / 2, px(N - 1) - X0 + 12, GRID],
  ["drawFastHLine", X0 - 6, TY1, px(N - 1) - X0 + 12, GRID],
  ["text", "{y_hi}", X0 - 10, TY0, 1, 1, "MR", LABEL],
  ["text", "{y_lo}", X0 - 10, TY1, 1, 1, "MR", LABEL],
  ...[0, 3, 6, 9].map((i): RawWireOp => ["drawFastVLine", px(i), TY0, RBASE - TY0, GRID]),
  // Temperature line and hourly dots
  ...Array.from({ length: N - 1 }, (_, i): RawWireOp => ["drawLine", px(i), `{sy${i}a}`, px(i + 1), `{sy${i}b}`, LINE]),
  ...Array.from({ length: N }, (_, i): RawWireOp => ["fillCircle", px(i), `{dy${i}}`, 2, LINE]),
  // Rain chance bars on the same x axis
  ["text", "Rain", X0 - 10, RBASE - RH, 1, 1, "MR", LABEL],
  ...Array.from({ length: N }, (_, i): RawWireOp[] => [
    ["fillRect", px(i) - 7, `{ry${i}}`, 14, `{rh_${i}}`, BAR],
    ["text", `{rp${i}}`, px(i), `{rpy${i}}`, 1, 1, "BC", "#9CC8F0"],
  ]).flat(),
  ["drawFastHLine", X0 - 6, RBASE, px(N - 1) - X0 + 12, "#6A7A90"],
  // Hour labels every 3 hours
  ...[0, 3, 6, 9].map((i): RawWireOp => ["text", `{h${i}}`, px(i), RBASE + 4, 2, 1, "TC", i === 0 ? "#FFFFFF" : LABEL]),
  // Legend and credit
  ["fillRect", 8, 229, 10, 3, LINE],
  ["text", "temp", 22, 226, 1, 1, "TL", LABEL],
  ["fillRect", 56, 226, 8, 8, BAR],
  ["text", "chance of rain", 68, 226, 1, 1, "TL", LABEL],
  ["text", "Open-Meteo", 312, 226, 1, 1, "TR", "#6A7A90"],
];

const template: Template = {
  id: "weather-hourly-chart",
  name: "Hourly temperature chart",
  description: "The next 12 hours as a temperature line with hourly dots, rain-chance bars underneath, and the current conditions with the period's max and min.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("weather-hourly-chart", wire),
  sampleVars: {"clock":"01:09","cond":"Clear","dy0":110,"dy1":113,"dy10":81,"dy11":68,"dy2":115,"dy3":119,"dy4":123,"dy5":125,"dy6":115,"dy7":106,"dy8":98,"dy9":85,"h0":"01:00","h3":"04:00","h6":"07:00","h9":"10:00","max_t":"Max 22C","min_t":"Min 19C","place":"MELBOURNE","rh_0":19,"rh_1":12,"rh_10":25,"rh_11":28,"rh_2":8,"rh_3":8,"rh_4":7,"rh_5":7,"rh_6":8,"rh_7":10,"rh_8":14,"rh_9":20,"rp0":"48","rp1":"29","rp10":"63","rp11":"71","rp2":"21","rp3":"19","rp4":"18","rp5":"18","rp6":"19","rp7":"24","rp8":"36","rp9":"51","rpy0":179,"rpy1":186,"rpy10":173,"rpy11":170,"rpy2":190,"rpy3":190,"rpy4":191,"rpy5":191,"rpy6":190,"rpy7":188,"rpy8":184,"rpy9":178,"ry0":181,"ry1":188,"ry10":175,"ry11":172,"ry2":192,"ry3":192,"ry4":193,"ry5":193,"ry6":192,"ry7":190,"ry8":186,"ry9":180,"sy0a":110,"sy0b":113,"sy10a":81,"sy10b":68,"sy1a":113,"sy1b":115,"sy2a":115,"sy2b":119,"sy3a":119,"sy3b":123,"sy4a":123,"sy4b":125,"sy5a":125,"sy5b":115,"sy6a":115,"sy6b":106,"sy7a":106,"sy7b":98,"sy8a":98,"sy8b":85,"sy9a":85,"sy9b":81,"temp":"20C","title":"Next 12 hours","y_hi":"22C","y_lo":"18C"},
};

export default template;
