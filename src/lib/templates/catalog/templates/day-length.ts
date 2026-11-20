import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Day length tracker: today's daylight, the change since yesterday, a year chart and the next solstice.

const code = String.raw`// Today's day length and how much it changed since yesterday, from sunrise-sunset.org
// (free, no key). The year chart and the solstice countdown are computed here; if the API
// fails, the computed day lengths are shown instead.
// Set PLACE, LAT, LON and TZ for your location; now() should use the same timezone.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";

const BARS = 24; // two bars per month
const CHART_X = 16; // left edge of the first bar
const STEP = 12; // px per bar (10 px bar + 2 px gap)
const BASE_Y = 196; // bottom of the bars
const MIN_H = 8; // bar height for the shortest day
const MAX_H = 72; // bar height for the longest day

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const Y = Number(now("YYYY"));
const M = Number(now("MM"));
const D = Number(now("DD"));
const todayUtc = Date.UTC(Y, M - 1, D);
const pad = (n) => (n < 10 ? "0" : "") + n;
const isoDate = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); };
const doy = Math.round((todayUtc - Date.UTC(Y, 0, 1)) / 86400000); // 0-based day of year

export const place = PLACE;
export const date = now("ddd") + " " + D + " " + MONTHS[M - 1];

// Computed day length in seconds (sunrise to sunset, with refraction) for day-of-year n.
function calcLen(n) {
  const rad = Math.PI / 180;
  const decl = -23.44 * rad * Math.cos((2 * Math.PI * (n + 10)) / 365);
  const phi = LAT * rad;
  let c = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  c = Math.min(1, Math.max(-1, c));
  return Math.round(((2 * Math.acos(c)) / rad / 15) * 3600);
}

const hhmm = (iso) => String(iso).slice(11, 16);
async function sun(ms) {
  const r = await get(
    "https://api.sunrise-sunset.org/json?lat=" + LAT + "&lng=" + LON + "&formatted=0&tzid=" + TZ + "&date=" + isoDate(ms),
    { cache: 21600 },
  );
  if (r.status !== "OK") throw new Error("sunrise-sunset: " + r.status);
  return r.results;
}

let today = null, yday = null;
try {
  today = await sun(todayUtc);
  yday = await sun(todayUtc - 86400000);
} catch (e) {
  console.log("sunrise-sunset failed:", e.message);
}
const live = today !== null && yday !== null;
const lenToday = live ? today.day_length : calcLen(doy);
const lenYday = live ? yday.day_length : calcLen(doy - 1);

const hm = (s) => { const m = Math.round(s / 60); return Math.floor(m / 60) + "h " + pad(m % 60) + "m"; };
export const length = hm(lenToday);

const diff = lenToday - lenYday;
const a = Math.abs(diff);
const ms = a >= 60 ? Math.floor(a / 60) + "m " + pad(a % 60) + "s" : a + "s";
export const delta = (diff > 0 ? "+" : diff < 0 ? "-" : "") + ms;
export const delta_col = diff > 0 ? "#50E070" : diff < 0 ? "#FF6060" : "#C0C0C0";
export const delta_label = "VS YESTERDAY";

export const sunrise = live ? "Sunrise " + hhmm(today.sunrise) : "Sunrise --:--";
export const sunset = live ? "Sunset " + hhmm(today.sunset) : "Sunset --:--";
export const source = live ? "sunrise-sunset.org" : "computed";

// Year chart: bar i covers the half-month centred on day (i + 0.5) * 365 / BARS.
const lens = [];
for (let i = 0; i < BARS; i++) lens.push(calcLen(Math.round(((i + 0.5) * 365) / BARS)));
const lo = Math.min.apply(null, lens);
const hi = Math.max.apply(null, lens);
const H = [];
const cur = Math.min(BARS - 1, Math.floor((doy * BARS) / 365));
for (let i = 0; i < BARS; i++) {
  const h = Math.round(MIN_H + ((MAX_H - MIN_H) * (lens[i] - lo)) / Math.max(1, hi - lo));
  H.push(h);
}
export const b0_y = BASE_Y - H[0]; export const b0_h = H[0];
export const b1_y = BASE_Y - H[1]; export const b1_h = H[1];
export const b2_y = BASE_Y - H[2]; export const b2_h = H[2];
export const b3_y = BASE_Y - H[3]; export const b3_h = H[3];
export const b4_y = BASE_Y - H[4]; export const b4_h = H[4];
export const b5_y = BASE_Y - H[5]; export const b5_h = H[5];
export const b6_y = BASE_Y - H[6]; export const b6_h = H[6];
export const b7_y = BASE_Y - H[7]; export const b7_h = H[7];
export const b8_y = BASE_Y - H[8]; export const b8_h = H[8];
export const b9_y = BASE_Y - H[9]; export const b9_h = H[9];
export const b10_y = BASE_Y - H[10]; export const b10_h = H[10];
export const b11_y = BASE_Y - H[11]; export const b11_h = H[11];
export const b12_y = BASE_Y - H[12]; export const b12_h = H[12];
export const b13_y = BASE_Y - H[13]; export const b13_h = H[13];
export const b14_y = BASE_Y - H[14]; export const b14_h = H[14];
export const b15_y = BASE_Y - H[15]; export const b15_h = H[15];
export const b16_y = BASE_Y - H[16]; export const b16_h = H[16];
export const b17_y = BASE_Y - H[17]; export const b17_h = H[17];
export const b18_y = BASE_Y - H[18]; export const b18_h = H[18];
export const b19_y = BASE_Y - H[19]; export const b19_h = H[19];
export const b20_y = BASE_Y - H[20]; export const b20_h = H[20];
export const b21_y = BASE_Y - H[21]; export const b21_h = H[21];
export const b22_y = BASE_Y - H[22]; export const b22_h = H[22];
export const b23_y = BASE_Y - H[23]; export const b23_h = H[23];

// The current half-month bar is highlighted by a yellow bar drawn over it, with a marker above.
const curH = H[cur];
export const hl_x = CHART_X + cur * STEP;
export const hl_y = BASE_Y - curH;
export const hl_h = curH;
export const mk_x = hl_x + 5;
export const mk_l = hl_x + 1;
export const mk_r = hl_x + 9;
export const mk_t = BASE_Y - curH - 10;
export const mk_b = BASE_Y - curH - 4;

// Next solstice (21 Jun / 21 Dec are within a day of the real dates).
const jun = Date.UTC(Y, 5, 21), dec = Date.UTC(Y, 11, 21), junNext = Date.UTC(Y + 1, 5, 21);
const next = todayUtc <= jun ? jun : todayUtc <= dec ? dec : junNext;
const days = Math.round((next - todayUtc) / 86400000);
const longest = (new Date(next).getUTCMonth() === 11) === (LAT < 0);
const which = longest ? "Longest day" : "Shortest day";
export const solstice = days === 0 ? which + " is today!" : which + " in " + days + (days === 1 ? " day" : " days");
`;

const BG = "#000000";
const HEAD = "#1E1A08";
const ACCENT = "#FFD040";
const LABEL = "#A0A0A0";
const BAR = "#5A4818";

const barRows: RawWireOp[] = [];
for (let i = 0; i < 24; i++) barRows.push(["fillRect", 16 + i * 12, `{b${i}_y}`, 10, `{b${i}_h}`, BAR]);
const monthRows: RawWireOp[] = "JFMAMJJASOND".split("").map((m, i) => ["text", m, 16 + i * 24 + 11, 202, 1, 1, "TC", LABEL] as RawWireOp);

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 28, HEAD],
  ["text", "DAY LENGTH", 8, 14, 2, 1, "ML", ACCENT],
  ["text", "{place}", 96, 14, 2, 1, "ML", "#E0E0E0"],
  ["text", "{date}", 312, 14, 2, 1, "MR", "#E0E0E0"],
  // Big day length, change vs yesterday
  ["text", "{length}", 8, 36, 4, 2, "TL", "#FFFFFF"],
  ["text", "{delta}", 312, 40, 4, 1, "TR", "{delta_col}"],
  ["text", "{delta_label}", 312, 70, 1, 1, "TR", LABEL],
  ["text", "{sunrise}", 8, 96, 2, 1, "TL", "#FFB040"],
  ["text", "{sunset}", 312, 96, 2, 1, "TR", "#FF7050"],
  // Year chart
  ["drawFastHLine", 8, 117, 304, "#303030"],
  ...barRows,
  ["fillRect", "{hl_x}", "{hl_y}", 10, "{hl_h}", ACCENT],
  ["fillTriangle", "{mk_l}", "{mk_t}", "{mk_r}", "{mk_t}", "{mk_x}", "{mk_b}", "#FFFFFF"],
  ["drawFastHLine", 8, 197, 304, "#606060"],
  ...monthRows,
  // Solstice countdown and credit
  ["text", "{solstice}", 8, 226, 2, 1, "ML", "#FFFFFF"],
  ["text", "{source}", 312, 227, 1, 1, "MR", "#707070"],
];

const template: Template = {
  id: "day-length",
  name: "Day length tracker",
  description: "Today's hours of daylight, how much longer or shorter than yesterday, a year chart of day length and a countdown to the next solstice.",
  apis: ["sunrise-sunset.org", "now()"],
  category: "space",
  dataCode: code,
  rows: rows("day-length", wire),
  sampleVars: {"b0_h":70,"b0_y":126,"b10_h":9,"b10_y":187,"b11_h":8,"b11_y":188,"b12_h":10,"b12_y":186,"b13_h":13,"b13_y":183,"b14_h":19,"b14_y":177,"b15_h":26,"b15_y":170,"b16_h":33,"b16_y":163,"b17_h":41,"b17_y":155,"b18_h":48,"b18_y":148,"b19_h":56,"b19_y":140,"b1_h":66,"b1_y":130,"b20_h":63,"b20_y":133,"b21_h":68,"b21_y":128,"b22_h":71,"b22_y":125,"b23_h":72,"b23_y":124,"b2_h":61,"b2_y":135,"b3_h":54,"b3_y":142,"b4_h":46,"b4_y":150,"b5_h":38,"b5_y":158,"b6_h":31,"b6_y":165,"b7_h":24,"b7_y":172,"b8_h":17,"b8_y":179,"b9_h":12,"b9_y":184,"date":"Sat 21 Nov","delta":"+1m 39s","delta_col":"#50E070","delta_label":"VS YESTERDAY","hl_h":68,"hl_x":268,"hl_y":128,"length":"14h 20m","mk_b":124,"mk_l":269,"mk_r":277,"mk_t":118,"mk_x":273,"place":"MELBOURNE","solstice":"Longest day in 30 days","source":"sunrise-sunset.org","sunrise":"Sunrise 05:55","sunset":"Sunset 20:15"},
};

export default template;
