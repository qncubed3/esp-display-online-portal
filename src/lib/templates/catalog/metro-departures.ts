import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "./rows";
import type { Template } from "./types";

// Melbourne Metro departures + weather (port of Metro_Train_Schedule.ino)

const metroCode = String.raw`// Melbourne Metro departures + local weather.
// Ported from the Metro_Train_Schedule.ino ESP32 sketch.
// Change STOP_ID / PLATFORM to your station (PTV stop id) and LAT / LON for the weather.
const STOP_ID = "G1005"; // Altona
const PLATFORM = "P1";
const LAT = -37.8676;
const LON = 144.83;

const FOOTER = "#000080"; // footer bar colour (the icon draws on it)
const HIDE = -200; // y for icon parts that should not show

const ptvUrl = "https://esp32-ptv-display-um8x.vercel.app/departures?stop_id=" + STOP_ID +
  "&platform=" + PLATFORM + "&limit=4";
const wxUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
  "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m" +
  "&wind_speed_unit=kmh&timezone=Australia%2FMelbourne";

const [ptv, wx] = await Promise.all([
  get(ptvUrl, { cache: 30 }),
  get(wxUrl, { cache: 600 }).catch((e) => {
    console.log("weather failed:", e.message);
    return null;
  }),
]);

// ---- Header
const stop = ptv.stop || {};
export const station = String(stop.name || "Unknown").toUpperCase().slice(0, 13);
export const platform = String(stop.platform || "?");
export const platform_x = 8 + station.length * 12 + 10; // after the name (font 1 size 2 = 12 px/char)
export const clock = now("HH:mm");

// ---- Departures (up to 4 rows)
const deps = Array.isArray(ptv.departures) ? ptv.departures.slice(0, 4) : [];
function row(i) {
  const d = deps[i];
  if (!d) return { dest: "", time: "", min: "", minCol: "#000000", late: "", sep: "#000000" };
  const remain = typeof d.remain === "number" ? d.remain : -1;
  const lateMin = Math.round((d.delay || 0) / 60);
  return {
    dest: String(d.dest || "Unknown").slice(0, 15),
    time: String(d.time || "--:--"),
    min: remain < 0 ? "" : remain === 0 ? "NOW" : String(remain),
    minCol: remain <= 1 ? "#FFA500" : "#00FF00",
    late: lateMin > 0 ? "+" + lateMin + "m" : "",
    sep: "#808080",
  };
}
const r1 = row(0), r2 = row(1), r3 = row(2), r4 = row(3);
export const dest1 = r1.dest, time1 = r1.time, min1 = r1.min, min_col1 = r1.minCol, late1 = r1.late;
export const dest2 = r2.dest, time2 = r2.time, min2 = r2.min, min_col2 = r2.minCol, late2 = r2.late;
export const dest3 = r3.dest, time3 = r3.time, min3 = r3.min, min_col3 = r3.minCol, late3 = r3.late;
export const dest4 = r4.dest, time4 = r4.time, min4 = r4.min, min_col4 = r4.minCol, late4 = r4.late;
export const sep2 = r2.sep, sep3 = r3.sep, sep4 = r4.sep;
export const none = deps.length ? "" : "NO DEPARTURES";

// ---- Weather footer
const cur = wx && wx.current;
const code = cur ? cur.weather_code : -1;
function describe(c) {
  if (c === 0) return "CLEAR";
  if (c === 1 || c === 2) return "PARTLY CLOUDY";
  if (c === 3) return "CLOUDY";
  if (c === 45 || c === 48) return "FOG";
  if (c >= 51 && c <= 57) return "DRIZZLE";
  if (c >= 61 && c <= 67) return "RAIN";
  if (c >= 71 && c <= 77) return "SNOW";
  if (c >= 80 && c <= 82) return "SHOWERS";
  if (c >= 95) return "STORM";
  return "";
}
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const weather = cur
  ? Math.round(cur.temperature_2m) + "C  " + describe(code) + "  " + cur.relative_humidity_2m + "% RH"
  : "WEATHER UNAVAILABLE";
export const wind = cur ? Math.round(cur.wind_speed_10m) + " km/h " + DIRS[Math.round(cur.wind_direction_10m / 45) % 8] : "";

// Icon: sun, small sun + cloud, cloud, or cloud + drops (rain cyan, snow white, storm yellow).
const sunny = code === 0;
const part = code === 1 || code === 2;
const cloudy = code > 0;
const drops = (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
export const ic_sun_y = cur && sunny ? 230 : HIDE;
export const ic_psun_y = cur && part ? 226 : HIDE;
export const ic_cloud_y = cur && cloudy ? (drops ? 228 : 230) : HIDE;
export const ic_cloud = code === 45 || code === 48 ? "#D3D3D3" : "#FFFFFF";
export const ic_drop_y = cur && drops ? 235 : HIDE;
export const ic_drop = code >= 95 ? "#FFFF00" : code >= 71 && code <= 86 && !(code >= 80 && code <= 82) ? "#FFFFFF" : "#00FFFF";
`;

const metroWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header: station, platform, clock
  ["fillRect", 0, 0, 320, 32, "#000080"],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 2],
  ["setTextDatum", "TL"],
  ["drawString", "{station}", 8, 9, 1],
  ["setTextSize", 1],
  ["setTextColor", "#D3D3D3"],
  ["drawString", "PLATFORM {platform}", "{platform_x}", 13, 1],
  ["setTextColor", "#FFFFFF"],
  ["setTextSize", 2],
  ["setTextDatum", "TR"],
  ["drawString", "{clock}", 312, 9, 1],
  // Column headers
  ["setTextSize", 1],
  ["setTextColor", "#D3D3D3"],
  ["setTextDatum", "TL"],
  ["drawString", "DESTINATION", 8, 40, 1],
  ["drawString", "TIME", 200, 40, 1],
  ["setTextDatum", "TR"],
  ["drawString", "MIN", 312, 40, 1],
  ["drawFastHLine", 0, 52, 320, "#808080"],
  // Row separators
  ["drawFastHLine", 5, 94, 310, "{sep2}"],
  ["drawFastHLine", 5, 133, 310, "{sep3}"],
  ["drawFastHLine", 5, 172, 310, "{sep4}"],
  // Departures: destination, time, minutes, delay
  ...[1, 2, 3, 4].flatMap((n): RawWireOp[] => {
    const y = 60 + (n - 1) * 39;
    return [
      ["setTextSize", 2],
      ["setTextDatum", "TL"],
      ["setTextColor", "#FFFFFF"],
      ["drawString", `{dest${n}}`, 8, y, 1],
      ["setTextColor", "#FFFF00"],
      ["drawString", `{time${n}}`, 200, y, 1],
      ["setTextDatum", "TR"],
      ["setTextColor", `{min_col${n}}`],
      ["drawString", `{min${n}}`, 312, y, 1],
      ["setTextSize", 1],
      ["setTextColor", "#FF0000"],
      ["drawString", `{late${n}}`, 312, y + 19, 1],
    ];
  }),
  ["setTextSize", 2],
  ["setTextDatum", "MC"],
  ["setTextColor", "#FF0000"],
  ["drawString", "{none}", 160, 130, 1],
  // Weather footer
  ["fillRect", 0, 220, 320, 20, "#000080"],
  ["fillCircle", 14, "{ic_sun_y}", 6, "#FFFF00"],
  ["fillCircle", 11, "{ic_psun_y}", 4, "#FFFF00"],
  ["fillCircle", 14, "{ic_cloud_y}", 4, "{ic_cloud}"],
  ["fillCircle", 20, "{ic_cloud_y}", 5, "{ic_cloud}"],
  ["fillRect", 10, "{ic_cloud_y}", 16, 5, "{ic_cloud}"],
  ["fillRect", 12, "{ic_drop_y}", 2, 4, "{ic_drop}"],
  ["fillRect", 17, "{ic_drop_y}", 2, 4, "{ic_drop}"],
  ["fillRect", 22, "{ic_drop_y}", 2, 4, "{ic_drop}"],
  ["setTextSize", 1],
  ["setTextColor", "#FFFFFF"],
  ["setTextDatum", "ML"],
  ["drawString", "{weather}", 32, 230, 1],
  ["setTextDatum", "MR"],
  ["drawString", "{wind}", 312, 230, 1],
];

export const metroDepartures: Template = {
  id: "metro-departures",
  name: "Metro departures + weather",
  description: "Next four trains from a Melbourne Metro platform, with live delays and a weather footer.",
  apis: ["PTV departures proxy", "Open-Meteo"],
  category: "transport",
  dataCode: metroCode,
  rows: rows("metro-departures", metroWire),
  sampleVars: {"clock": "22:50", "dest1": "Werribee", "dest2": "Sandringham", "dest3": "Werribee", "dest4": "Sandringham", "ic_cloud": "#FFFFFF", "ic_cloud_y": 230, "ic_drop": "#00FFFF", "ic_drop_y": -200, "ic_psun_y": 226, "ic_sun_y": -200, "late1": "+2m", "late2": "", "late3": "+3m", "late4": "", "min1": "1", "min2": "5", "min3": "22", "min4": "25", "min_col1": "#FFA500", "min_col2": "#00FF00", "min_col3": "#00FF00", "min_col4": "#00FF00", "none": "", "platform": "1", "platform_x": 90, "sep2": "#808080", "sep3": "#808080", "sep4": "#808080", "station": "ALTONA", "time1": "22:52", "time2": "22:56", "time3": "23:13", "time4": "23:16", "weather": "20C  PARTLY CLOUDY  64% RH", "wind": "14 km/h N"},
};
