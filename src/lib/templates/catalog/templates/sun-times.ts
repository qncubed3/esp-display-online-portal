import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Sun times: sunrise, sunset, solar noon, day length, first and last light, and a day bar.

const sunCode = String.raw`// Today's sun times from sunrise-sunset.org (free, no key), with Open-Meteo as a fallback.
// Set PLACE, LAT, LON and TZ for your location; now() should use the same timezone.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";

const BAR_X = 16; // the day bar runs from first light (left) to last light (right)
const BAR_W = 288;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const place = PLACE + "  " + now("ddd") + " " + Number(now("DD")) + " " + MONTHS[Number(now("MM")) - 1];
export const clock = now("HH:mm");
const nowMin = Number(now("HH")) * 60 + Number(now("mm"));

// "2026-11-21T05:55:55+11:00" or "2026-11-21T05:56" -> minutes after local midnight
function mins(iso) {
  const t = String(iso).slice(11, 19);
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + (Number(t.slice(6, 8)) >= 30 ? 1 : 0);
}
const pad = (n) => (n < 10 ? "0" : "") + n;
const hhmm = (m) => pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
const span = (m) => (m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + "m");

let rise = null, set = null, noon = null, first = null, last = null, length = null;
try {
  const r = await get(
    "https://api.sunrise-sunset.org/json?lat=" + LAT + "&lng=" + LON + "&formatted=0&date=" + now("YYYY-MM-DD") + "&tzid=" + TZ,
    { cache: 3600 },
  );
  if (r.status !== "OK") throw new Error("sunrise-sunset: " + r.status);
  const s = r.results;
  rise = mins(s.sunrise); set = mins(s.sunset); noon = mins(s.solar_noon);
  first = mins(s.civil_twilight_begin); last = mins(s.civil_twilight_end);
  length = Math.round(s.day_length / 60);
} catch (e) {
  console.log("sunrise-sunset failed:", e.message);
  try {
    const om = await get(
      "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
        "&daily=sunrise,sunset,daylight_duration&timezone=" + encodeURIComponent(TZ) + "&forecast_days=1",
      { cache: 3600 },
    );
    rise = mins(om.daily.sunrise[0]); set = mins(om.daily.sunset[0]);
    noon = Math.round((rise + set) / 2);
    length = Math.round(om.daily.daylight_duration[0] / 60);
  } catch (e2) {
    console.log("open-meteo failed:", e2.message);
  }
}
const ok = rise !== null;

export const sunrise = ok ? hhmm(rise) : "--:--";
export const sunset = ok ? hhmm(set) : "--:--";
export const solar_noon = ok ? hhmm(noon) : "--:--";
export const first_light = first !== null ? hhmm(first) : "--:--";
export const last_light = last !== null ? hhmm(last) : "--:--";
export const day_length = ok ? "Day " + span(length) : "Sun times unavailable";

// Day bar: whole bar = first light .. last light (about 30 min either side without twilight data).
const fl = first !== null ? first : ok ? rise - 30 : 0;
const ll = last !== null ? last : ok ? set + 30 : 1440;
const px = (m) => Math.round(BAR_X + (BAR_W * (Math.min(Math.max(m, fl), ll) - fl)) / (ll - fl));
export const day_x = ok ? px(rise) : BAR_X;
export const day_w = ok ? px(set) - px(rise) : 0;
export const done_w = ok ? Math.max(0, px(Math.min(nowMin, set)) - px(rise)) : 0;
export const sun_x = px(nowMin);
export const sun_y = ok ? 138 : -100;

let state = "";
let col = "#FFE040";
if (!ok) state = "";
else if (nowMin < fl) { state = "Night - first light " + hhmm(fl); col = "#8090B0"; }
else if (nowMin < rise) { state = "Sunrise in " + span(rise - nowMin); col = "#FF9040"; }
else if (nowMin < set) state = Math.floor((100 * (nowMin - rise)) / (set - rise)) + "% done, " + span(set - nowMin) + " left";
else if (nowMin < ll) { state = "Dark in " + span(ll - nowMin); col = "#FF9040"; }
else { state = "Night - sunrise " + hhmm(rise); col = "#8090B0"; }
export const status = state;
export const sun_col = col;
`;

const BG = "#000000";
const CARD = "#1A2436";
const LABEL = "#A0B0C8";
const sunWire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: place and date, current time
  ["fillRect", 0, 0, 320, 30, "#0C1A33"],
  ["text", "{place}", 8, 15, 2, 1, "ML", "#C8D4E8"],
  ["text", "{clock}", 312, 16, 4, 1, "MR", "#FFFFFF"],
  // Sunrise and sunset, big
  ["fillRoundRect", 6, 36, 151, 82, 6, CARD],
  ["fillRoundRect", 163, 36, 151, 82, 6, CARD],
  ["fillTriangle", 36, 54, 44, 44, 52, 54, "#FFB040"],
  ["text", "SUNRISE", 60, 42, 2, 1, "TL", "#FFB040"],
  ["fillTriangle", 192, 44, 200, 54, 208, 44, "#FF7050"],
  ["text", "SUNSET", 216, 42, 2, 1, "TL", "#FF7050"],
  ["text", "{sunrise}", 82, 62, 4, 2, "TC", "#FFFFFF"],
  ["text", "{sunset}", 239, 62, 4, 2, "TC", "#FFFFFF"],
  // Day bar: twilight (blue), daylight (dim amber), daylight gone (bright), sun marker
  ["fillRoundRect", 16, 133, 288, 10, 5, "#283C78"],
  ["fillRect", "{day_x}", 133, "{day_w}", 10, "#6A5018"],
  ["fillRect", "{day_x}", 133, "{done_w}", 10, "#FFC020"],
  ["fillCircle", "{sun_x}", "{sun_y}", 9, BG],
  ["fillCircle", "{sun_x}", "{sun_y}", 7, "{sun_col}"],
  ["text", "{day_length}", 8, 154, 2, 1, "TL", "#FFFFFF"],
  ["text", "{status}", 312, 154, 2, 1, "TR", "{sun_col}"],
  // First light, solar noon, last light
  ["fillRoundRect", 6, 176, 98, 58, 6, CARD],
  ["fillRoundRect", 111, 176, 98, 58, 6, CARD],
  ["fillRoundRect", 216, 176, 98, 58, 6, CARD],
  ["text", "FIRST LIGHT", 55, 184, 1, 1, "TC", LABEL],
  ["text", "SOLAR NOON", 160, 184, 1, 1, "TC", LABEL],
  ["text", "LAST LIGHT", 265, 184, 1, 1, "TC", LABEL],
  ["text", "{first_light}", 55, 200, 4, 1, "TC", "#8CB4FF"],
  ["text", "{solar_noon}", 160, 200, 4, 1, "TC", "#FFE040"],
  ["text", "{last_light}", 265, 200, 4, 1, "TC", "#8CB4FF"],
];

const template: Template = {
  id: "sun-times",
  name: "Sun times",
  description: "Big sunrise and sunset, first and last light, solar noon, day length and a bar showing how far through daylight we are.",
  apis: ["sunrise-sunset.org", "Open-Meteo", "now()"],
  category: "clocks",
  dataCode: sunCode,
  rows: rows("sun-times", sunWire),
  sampleVars: {"clock": "15:42", "day_length": "Day 14h 20m", "day_w": 270, "day_x": 25, "done_w": 184, "first_light": "05:26", "last_light": "20:46", "place": "MELBOURNE  Sat 21 Nov", "solar_noon": "13:06", "status": "68% done, 4h 34m left", "sun_col": "#FFE040", "sun_x": 209, "sun_y": 138, "sunrise": "05:56", "sunset": "20:16"},
};

export default template;
