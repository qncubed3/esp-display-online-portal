import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Population clock: world and one country, extrapolated live from World Bank data

const dataCode = String.raw`// World and one country's population right now, estimated from the World Bank's
// two latest yearly figures (mid-year values) and the growth between them, so the
// numbers tick up on every poll. One keyless request covers both.
const COUNTRY = "AU"; // ISO 2-letter code, e.g. "NZ", "GB", "US"
const LABEL = "AUSTRALIA"; // name shown on the second card

const URL = "https://api.worldbank.org/v2/country/WLD;" + COUNTRY + "/indicator/SP.POP.TOTL?format=json&mrv=2";
const YEAR_MS = 365.2425 * 86400000;

// 8215424893 -> "8,215,424,893"
function commas(n) {
  const s = String(Math.round(n));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}

// rows: [{ date, value }] for one country -> live estimate
function estimate(list) {
  const pts = list.filter((r) => typeof r.value === "number" && r.value > 0).sort((a, b) => Number(b.date) - Number(a.date));
  if (pts.length < 2) return null;
  const y1 = Number(pts[0].date), v1 = pts[0].value;
  const y0 = Number(pts[1].date), v0 = pts[1].value;
  const rate = Math.pow(v1 / v0, 1 / Math.max(1, y1 - y0)) - 1; // yearly growth
  const t = (Date.now() - Date.UTC(y1, 6, 1)) / YEAR_MS; // years since mid-year of latest figure
  const pop = v1 * Math.pow(1 + rate, t);
  return { pop, rate, perDay: (pop * rate) / 365.2425, year: y1 };
}

let world = null, local = null;
try {
  const d = await get(URL, { cache: 86400 });
  const data = Array.isArray(d) && Array.isArray(d[1]) ? d[1] : [];
  world = estimate(data.filter((r) => r.countryiso3code === "WLD" || (r.country && r.country.id === "1W")));
  local = estimate(data.filter((r) => r.country && r.country.id === COUNTRY));
} catch (e) {
  console.log("World Bank failed:", e.message);
}

const pct = (r) => (r >= 0 ? "+" : "") + (r * 100).toFixed(2) + "% a year";
const day = (n) => (n >= 0 ? "+" : "-") + commas(Math.abs(n)) + " a day";

export const world_pop = world ? commas(world.pop) : "--";
export const world_rate = world ? pct(world.rate) : "";
export const world_day = world ? day(world.perDay) : "No data";
export const local_label = LABEL;
export const local_pop = local ? commas(local.pop) : "--";
export const local_rate = local ? pct(local.rate) : "";
export const local_day = local ? day(local.perDay) : "No data";
export const source = world || local ? "Estimate from World Bank " + (world || local).year + " data" : "World Bank data unavailable";
export const date = now("ddd DD/MM HH:mm");
`;

const BG = "#0B1016";
const CARD = "#141C26";
const GREY = "#8B95A3";
const WORLD = "#4FC3F7";
const LOCAL = "#FFC14D";

const card = (top: number, label: string, color: string, p: string): RawWireOp[] => [
  ["fillRoundRect", 6, top, 308, 92, 6, CARD],
  ["fillRect", 6, top + 8, 3, 76, color],
  ["text", label, 18, top + 10, 2, 1, "TL", color],
  ["text", `{${p}_rate}`, 304, top + 10, 2, 1, "TR", GREY],
  ["text", `{${p}_pop}`, 18, top + 34, 4, 1, "TL", "#FFFFFF"],
  ["text", `{${p}_day}`, 18, top + 68, 2, 1, "TL", GREY],
];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 26, "#18222E"],
  ["text", "POPULATION CLOCK", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{date}", 312, 13, 2, 1, "MR", GREY],
  ...card(32, "WORLD", WORLD, "world"),
  ...card(130, "{local_label}", LOCAL, "local"),
  ["text", "{source}", 160, 232, 1, 1, "MC", "#5C6673"],
];

const template: Template = {
  id: "world-population",
  name: "Population clock",
  description: "Live estimate of the world and Australian populations, ticking up from the World Bank's latest growth rate.",
  apis: ["World Bank"],
  category: "world",
  dataCode,
  rows: rows("world-population", wire),
  sampleVars: {"date":"Sat 21/11 01:25","local_day":"+1,193 a day","local_label":"AUSTRALIA","local_pop":"28,209,086","local_rate":"+1.54% a year","source":"Estimate from World Bank 2025 data","world_day":"+208,542 a day","world_pop":"8,320,134,778","world_rate":"+0.92% a year"},
};

export default template;
