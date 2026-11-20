import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Australian capitals weather: 8 cards, one Open-Meteo call for all cities.

const code = String.raw`// Current temperature in the 8 Australian capitals, from Open-Meteo (free, no key).
// One request covers all cities: comma-separated latitude/longitude return an array.
const CITIES = [
  ["Sydney", -33.87, 151.21],
  ["Melbourne", -37.81, 144.96],
  ["Brisbane", -27.47, 153.03],
  ["Perth", -31.95, 115.86],
  ["Adelaide", -34.93, 138.6],
  ["Hobart", -42.88, 147.33],
  ["Darwin", -12.46, 130.84],
  ["Canberra", -35.28, 149.13],
];
const CARD_CX = [43, 121, 199, 277]; // card centres, must match Draw

function describe(n) {
  if (n === 0) return "Clear";
  if (n === 1) return "Fair";
  if (n === 2) return "Pt cloudy";
  if (n === 3) return "Overcast";
  if (n === 45 || n === 48) return "Fog";
  if (n >= 51 && n <= 57) return "Drizzle";
  if (n >= 61 && n <= 67) return "Rain";
  if (n >= 71 && n <= 77) return "Snow";
  if (n >= 80 && n <= 82) return "Showers";
  if (n === 85 || n === 86) return "Snow";
  if (n >= 95) return "Storm";
  return "";
}

// Blue (cold) -> cyan -> yellow -> orange -> red (hot)
const STOPS = [[0, 60, 124, 255], [12, 60, 210, 255], [20, 255, 230, 90], [28, 255, 150, 50], [38, 255, 60, 60]];
function hex2(v) { const s = Math.round(v).toString(16).toUpperCase(); return s.length < 2 ? "0" + s : s; }
function tempColour(t) {
  if (t <= STOPS[0][0]) return "#" + hex2(STOPS[0][1]) + hex2(STOPS[0][2]) + hex2(STOPS[0][3]);
  for (let i = 1; i < STOPS.length; i++) {
    const a = STOPS[i - 1], b = STOPS[i];
    if (t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]);
      return "#" + hex2(a[1] + (b[1] - a[1]) * f) + hex2(a[2] + (b[2] - a[2]) * f) + hex2(a[3] + (b[3] - a[3]) * f);
    }
  }
  const z = STOPS[STOPS.length - 1];
  return "#" + hex2(z[1]) + hex2(z[2]) + hex2(z[3]);
}

let data = null;
try {
  data = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=" + CITIES.map((c) => c[1]).join(",") +
      "&longitude=" + CITIES.map((c) => c[2]).join(",") +
      "&current=temperature_2m,weather_code",
    { cache: 900 },
  );
} catch (e) {
  data = null;
}
if (data && !Array.isArray(data)) data = [data];

const out = {};
for (let i = 0; i < 8; i++) {
  const cur = data && data[i] && data[i].current;
  const ok = cur && typeof cur.temperature_2m === "number";
  const t = ok ? Math.round(cur.temperature_2m) : null;
  const s = ok ? String(t) : "--";
  // Font 4 at size 2: digits 28 px, minus 16 px. Temp is centred 4 px left; ring sits after it.
  let w = 0;
  for (const ch of s) w += ch === "-" ? 16 : 28;
  out["c" + i + "_temp"] = s;
  out["c" + i + "_col"] = ok ? tempColour(t) : "#808080";
  out["c" + i + "_cond"] = ok ? describe(cur.weather_code) : "No data";
  out["c" + i + "_deg_x"] = ok ? CARD_CX[i % 4] - 4 + Math.round(w / 2) + 6 : -200;
}

export const clock = now("HH:mm");
export const c0_temp = out.c0_temp, c0_col = out.c0_col, c0_cond = out.c0_cond, c0_deg_x = out.c0_deg_x;
export const c1_temp = out.c1_temp, c1_col = out.c1_col, c1_cond = out.c1_cond, c1_deg_x = out.c1_deg_x;
export const c2_temp = out.c2_temp, c2_col = out.c2_col, c2_cond = out.c2_cond, c2_deg_x = out.c2_deg_x;
export const c3_temp = out.c3_temp, c3_col = out.c3_col, c3_cond = out.c3_cond, c3_deg_x = out.c3_deg_x;
export const c4_temp = out.c4_temp, c4_col = out.c4_col, c4_cond = out.c4_cond, c4_deg_x = out.c4_deg_x;
export const c5_temp = out.c5_temp, c5_col = out.c5_col, c5_cond = out.c5_cond, c5_deg_x = out.c5_deg_x;
export const c6_temp = out.c6_temp, c6_col = out.c6_col, c6_cond = out.c6_cond, c6_deg_x = out.c6_deg_x;
export const c7_temp = out.c7_temp, c7_col = out.c7_col, c7_cond = out.c7_cond, c7_deg_x = out.c7_deg_x;
`;

const CITY_NAMES = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Hobart", "Darwin", "Canberra"];
const CARD = "#18283C";
const CARD_W = 74;
const CARD_H = 98;
const ROW_Y = [32, 136];

const cards: RawWireOp[] = CITY_NAMES.flatMap((city, i): RawWireOp[] => {
  const x = 6 + (i % 4) * 78;
  const cx = x + CARD_W / 2;
  const y = ROW_Y[Math.floor(i / 4)];
  return [
    ["fillRoundRect", x, y, CARD_W, CARD_H, 6, CARD],
    ["text", city, cx, y + 6, 2, 1, "TC", "#FFFFFF"],
    ["text", `{c${i}_temp}`, cx - 4, y + 50, 4, 2, "MC", `{c${i}_col}`],
    ["drawCircle", `{c${i}_deg_x}`, y + 31, 4, `{c${i}_col}`],
    ["drawCircle", `{c${i}_deg_x}`, y + 31, 3, `{c${i}_col}`],
    ["text", `{c${i}_cond}`, cx, y + 78, 2, 1, "TC", "#A0B0C0"],
  ];
});

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#003366"],
  ["text", "AUSTRALIA NOW", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C0D0E0"],
  ...cards,
];

const template: Template = {
  id: "aus-cities-weather",
  name: "Australian Capitals Weather",
  description: "Current temperature and conditions in all 8 Australian capital cities, coloured from cold blue to hot red.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("aus-cities-weather", wire),
  sampleVars: {"c0_col":"#FFE65A","c0_cond":"Drizzle","c0_deg_x":73,"c0_temp":"20","c1_col":"#FFE65A","c1_cond":"Clear","c1_deg_x":151,"c1_temp":"20","c2_col":"#E7E46F","c2_cond":"Pt cloudy","c2_deg_x":229,"c2_temp":"19","c3_col":"#CEE183","c3_cond":"Clear","c3_deg_x":307,"c3_temp":"18","c4_col":"#B6DF98","c4_cond":"Clear","c4_deg_x":73,"c4_temp":"17","c5_col":"#B6DF98","c5_cond":"Overcast","c5_deg_x":151,"c5_temp":"17","c6_col":"#FF8D33","c6_cond":"Overcast","c6_deg_x":229,"c6_temp":"29","c7_col":"#B6DF98","c7_cond":"Overcast","c7_deg_x":307,"c7_temp":"17","clock":"01:06"},
};

export default template;
