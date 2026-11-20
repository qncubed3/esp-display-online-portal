import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Will it rain soon? A headline answer, a 3-hour bar chart in 15-minute steps and the current weather.

const SLOTS = 12; // 15-minute slots shown (3 hours)
const CHART_X = 10; // chart runs from x 10 to 310
const SLOT_W = 25;
const BASE_Y = 186; // chart baseline
const CHART_H = 86; // chart height (top at y 100)

const rainCode = String.raw`// Rain in the next 3 hours from Open-Meteo (free, no key): 15-minute precipitation and
// chance of rain, falling back to hourly data. Set PLACE, LAT, LON and TZ for your location.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const TZ = "Australia/Melbourne";
const WET_MM = 0.1; // a 15-minute slot with at least this much counts as rain

const SLOTS = 12;
const CHART_H = 86;
const BASE_Y = 186;
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
      "&current=temperature_2m,precipitation,weather_code" +
      "&minutely_15=precipitation,precipitation_probability&forecast_minutely_15=16" +
      "&hourly=precipitation,precipitation_probability&forecast_hours=5" +
      "&timezone=" + encodeURIComponent(TZ),
    { cache: 900 },
  );
} catch (e) {
  console.log("open-meteo failed:", e.message);
}

const cur = r && r.current;
export const place = PLACE;
export const clock = now("HH:mm");
const temp = cur && cur.temperature_2m != null ? Math.round(cur.temperature_2m) + "C" : "--";
const cond = cur && cur.weather_code != null ? WMO[cur.weather_code] || "" : "";
export const current = temp + (cond ? "  " + cond : "");

// "2026-11-21T14:30" + n minutes, as local wall-clock text
const addMin = (t, n) => new Date(Date.parse(t + ":00Z") + n * 60000).toISOString().slice(0, 16);

// Build SLOTS slots: { t, mm, p }
let slots = [];
const m = r && r.minutely_15;
if (m && m.time && m.precipitation) {
  let start = cur && cur.time ? m.time.findIndex((t) => t >= cur.time) : 0;
  if (start < 0) start = 0;
  for (let i = start; i < m.time.length && slots.length < SLOTS; i++) {
    if (m.precipitation[i] == null) break;
    const p = m.precipitation_probability ? m.precipitation_probability[i] : null;
    slots.push({ t: m.time[i], mm: m.precipitation[i], p: p });
  }
}
const h = r && r.hourly;
if (slots.length < SLOTS && h && h.time && h.precipitation) {
  // Hourly fallback: spread each hour's total over its four 15-minute slots
  slots = [];
  const t0 = cur && cur.time ? cur.time : h.time[0];
  for (let i = 0; i < SLOTS; i++) {
    const t = addMin(t0, i * 15);
    const k = h.time.findIndex((x) => x.slice(0, 13) === t.slice(0, 13));
    if (k < 0 || h.precipitation[k] == null) break;
    const p = h.precipitation_probability ? h.precipitation_probability[k] : null;
    slots.push({ t: t, mm: h.precipitation[k] / 4, p: p });
  }
}
const ok = slots.length > 0;
const hhmm = (t) => t.slice(11, 16);
const endT = ok ? addMin(slots[slots.length - 1].t, 15) : "";
const hours = Math.round((slots.length * 15) / 60);

// Headline
const wet = slots.map((s) => s.mm >= WET_MM);
const firstWet = wet.indexOf(true);
const total = slots.reduce((a, s) => a + s.mm, 0);
let peak = -1, peakAt = 0;
slots.forEach((s, i) => { if (s.p != null && s.p > peak) { peak = s.p; peakAt = i; } });
let head = "No forecast", sub = "Open-Meteo unavailable", col = "#A0B0C8";
if (ok && firstWet < 0) {
  head = "Dry for " + hours + " hour" + (hours === 1 ? "" : "s");
  col = "#60E080";
  sub = peak >= 10 ? "Peak chance " + peak + "% at " + hhmm(slots[peakAt].t) : "Less than 10% chance of rain";
} else if (ok) {
  col = "#4FA8FF";
  if (firstWet === 0) {
    const dry = wet.indexOf(false);
    head = dry < 0 ? "Rain for " + hours + "+ hours" : "Rain until " + hhmm(slots[dry].t);
  } else {
    head = "Rain from " + hhmm(slots[firstWet].t);
  }
  sub = (Math.round(total * 10) / 10).toFixed(1) + " mm in " + hours + " h" + (peak >= 0 ? ", peak chance " + peak + "%" : "");
}
export const headline = head;
export const head_col = col;
export const detail = sub;

// Chart: bars scale to at least 1 mm per 15 minutes
const maxMm = slots.reduce((a, s) => Math.max(a, s.mm), 0);
const top = Math.max(1, Math.ceil(maxMm * 2) / 2);
export const scale = ok ? top.toFixed(1) + " mm" : "";

// Per slot: chance shade (py/ph_), rain bar (by/bh_) and chance label (pc), hidden when missing.
`;

// Data can't export from a loop, so the per-slot exports are generated here.
const slotExports = Array.from({ length: SLOTS }, (_, i) =>
  [
    `const s${i} = slots[${i}];`,
    `const ph${i} = s${i} && s${i}.p != null ? Math.round((s${i}.p / 100) * CHART_H) : 0;`,
    `const bh${i} = s${i} && s${i}.mm > 0 ? Math.max(3, Math.round((s${i}.mm / top) * CHART_H)) : 0;`,
    `export const py${i} = ph${i} > 0 ? BASE_Y - ph${i} : HIDE;`,
    `export const ph_${i} = ph${i};`,
    `export const by${i} = bh${i} > 0 ? BASE_Y - bh${i} : HIDE;`,
    `export const bh_${i} = bh${i};`,
    `export const pc${i} = s${i} && s${i}.p != null ? String(s${i}.p) : "";`,
  ].join("\n"),
).join("\n");

const labelExports = [
  `export const t0 = ok ? hhmm(slots[0].t) : "";`,
  `export const t4 = slots.length > 4 ? hhmm(slots[4].t) : "";`,
  `export const t8 = slots.length > 8 ? hhmm(slots[8].t) : "";`,
  `export const t_end = ok ? hhmm(endT) : "";`,
].join("\n");

const code = rainCode + slotExports + "\n" + labelExports + "\n";

const BG = "#000000";
const LABEL = "#A0B0C8";
const SHADE = "#1E3A5F";
const BAR = "#4FA8FF";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: place and time on the left, temperature and conditions on the right
  ["fillRect", 0, 0, 320, 28, "#0C1A33"],
  ["text", "{place}", 8, 14, 2, 1, "ML", "#C8D4E8"],
  ["text", "{clock}", 96, 14, 2, 1, "ML", LABEL],
  ["text", "{current}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Headline answer
  ["text", "{headline}", 160, 48, 4, 1, "MC", "{head_col}"],
  ["text", "{detail}", 160, 74, 2, 1, "MC", LABEL],
  // Chart frame
  ["text", "100%", CHART_X, 92, 1, 1, "TL", "#5A86B8"],
  ["text", "{scale}", 310, 92, 1, 1, "TR", BAR],
  ["drawFastHLine", CHART_X, BASE_Y - CHART_H, 300, "#1A2436"],
  ["drawFastHLine", CHART_X, BASE_Y - CHART_H / 2, 300, "#1A2436"],
];
for (let i = 0; i < SLOTS; i++) {
  const x = CHART_X + i * SLOT_W;
  wire.push(
    ["fillRect", x + 2, `{py${i}}`, SLOT_W - 4, `{ph_${i}}`, SHADE],
    ["fillRect", x + 6, `{by${i}}`, SLOT_W - 12, `{bh_${i}}`, BAR],
    ["text", `{pc${i}}`, x + SLOT_W / 2, BASE_Y + 4, 1, 1, "TC", "#7F9AB8"],
  );
}
wire.push(
  ["drawFastHLine", CHART_X, BASE_Y, 300, "#6A7A90"],
  // Time axis
  ["text", "{t0}", CHART_X, 200, 2, 1, "TL", "#FFFFFF"],
  ["text", "{t4}", CHART_X + 4 * SLOT_W, 200, 2, 1, "TC", LABEL],
  ["text", "{t8}", CHART_X + 8 * SLOT_W, 200, 2, 1, "TC", LABEL],
  ["text", "{t_end}", 310, 200, 2, 1, "TR", LABEL],
  // Legend and credit
  ["fillRect", CHART_X, 224, 8, 8, SHADE],
  ["text", "chance", CHART_X + 12, 224, 1, 1, "TL", LABEL],
  ["fillRect", 70, 224, 8, 8, BAR],
  ["text", "rain per 15 min", 82, 224, 1, 1, "TL", LABEL],
  ["text", "Open-Meteo", 310, 224, 1, 1, "TR", "#6A7A90"],
);

const template: Template = {
  id: "rain-next-hours",
  name: "Rain next hours",
  description: "Will it rain soon? A headline answer, a 3-hour chart of rain and chance in 15-minute steps, and the current temperature.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("rain-next-hours", wire),
  sampleVars: {"bh_0":9,"bh_1":34,"bh_10":0,"bh_11":0,"bh_2":34,"bh_3":34,"bh_4":34,"bh_5":34,"bh_6":34,"bh_7":34,"bh_8":34,"bh_9":0,"by0":177,"by1":152,"by10":-200,"by11":-200,"by2":152,"by3":152,"by4":152,"by5":152,"by6":152,"by7":152,"by8":152,"by9":-200,"clock":"01:06","current":"20C  Drizzle","detail":"3.3 mm in 3 h, peak chance 74%","head_col":"#4FA8FF","headline":"Rain until 03:15","pc0":"74","pc1":"71","pc10":"59","pc11":"58","pc2":"69","pc3":"67","pc4":"65","pc5":"64","pc6":"63","pc7":"62","pc8":"61","pc9":"60","ph_0":64,"ph_1":61,"ph_10":51,"ph_11":50,"ph_2":59,"ph_3":58,"ph_4":56,"ph_5":55,"ph_6":54,"ph_7":53,"ph_8":52,"ph_9":52,"place":"MELBOURNE","py0":122,"py1":125,"py10":135,"py11":136,"py2":127,"py3":128,"py4":130,"py5":131,"py6":132,"py7":133,"py8":134,"py9":134,"scale":"1.0 mm","t0":"01:00","t4":"02:00","t8":"03:00","t_end":"04:00"},
};

export default template;
