import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Bitcoin ticker: big price, 24 h change, high/low and a 24-segment sparkline.

const N = 24; // sparkline segments (N + 1 points)
const CHART_X0 = 18; // left of the sparkline
const CHART_STEP = 12; // px between points: 24 * 12 = 288, so x runs 18..306
const px = (i: number) => CHART_X0 + i * CHART_STEP;

const code = String.raw`// Bitcoin price from CoinGecko (free, no key, about 30 requests/min shared by everyone,
// so the price is cached 120 s and the chart 600 s).
// The 24 h chart is downsampled to 25 points; Draw joins them with 24 lines.
const CURRENCY = "aud";
const N = 24; // segments
const TOP = 156, BOTTOM = 222; // sparkline y range in Draw
const UP = "#3ECF8E", DOWN = "#FF5A5F", FLAT = "#A0A0A0";

function money(v) {
  if (typeof v !== "number" || !isFinite(v)) return "--";
  return "$" + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

let price = null, change = null;
try {
  const p = await get(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=" + CURRENCY + "&include_24hr_change=true",
    { cache: 120 },
  );
  const b = (p && p.bitcoin) || {};
  if (typeof b[CURRENCY] === "number") price = b[CURRENCY];
  if (typeof b[CURRENCY + "_24h_change"] === "number") change = b[CURRENCY + "_24h_change"];
} catch (e) {
  console.log("price failed: " + e);
}

let series = [];
try {
  const c = await get(
    "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=" + CURRENCY + "&days=1",
    { cache: 600 },
  );
  series = ((c && c.prices) || []).map((r) => r[1]).filter((v) => typeof v === "number" && isFinite(v));
} catch (e) {
  console.log("chart failed: " + e);
}

// Fall back to the chart if the price call failed.
if (price === null && series.length) price = series[series.length - 1];
if (change === null && series.length > 1 && series[0] > 0) change = (series[series.length - 1] / series[0] - 1) * 100;

let hi = null, lo = null;
if (series.length) {
  hi = Math.max.apply(null, series);
  lo = Math.min.apply(null, series);
  if (price !== null) { hi = Math.max(hi, price); lo = Math.min(lo, price); }
}

// Downsample to N + 1 points, evenly spaced through the day; the last point is the live price.
const pts = [];
if (series.length > 1) {
  for (let i = 0; i <= N; i++) pts.push(series[Math.round((i * (series.length - 1)) / N)]);
  if (price !== null) pts[N] = price;
}
const ys = [];
if (pts.length) {
  const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts);
  const span = mx - mn || 1;
  for (let i = 0; i <= N; i++) ys.push(Math.round(BOTTOM - ((pts[i] - mn) / span) * (BOTTOM - TOP)));
} else {
  for (let i = 0; i <= N; i++) ys.push(-200); // no chart: lines go off screen
}

const hasChg = typeof change === "number";
const up = hasChg && change >= 0;
export const col = !hasChg ? FLAT : up ? UP : DOWN;
export const price_txt = price === null ? "No data" : money(price);
export const chg = hasChg ? (up ? "+" : "") + change.toFixed(2) + "%" : "";
// Arrow triangle (x 10..26): base and tip y, pointing up or down.
export const arr_base = !hasChg ? -200 : up ? 122 : 104;
export const arr_tip = !hasChg ? -200 : up ? 104 : 122;
export const high = "H " + money(hi);
export const low = "L " + money(lo);
export const open_y = ys[0]; // dotted guide at the price 24 h ago
export const chart_label = pts.length ? "24H" : "Chart unavailable";
export const clock = now("HH:mm");
export const s0 = ys[0], s1 = ys[1], s2 = ys[2], s3 = ys[3], s4 = ys[4], s5 = ys[5], s6 = ys[6], s7 = ys[7], s8 = ys[8];
export const s9 = ys[9], s10 = ys[10], s11 = ys[11], s12 = ys[12], s13 = ys[13], s14 = ys[14], s15 = ys[15], s16 = ys[16];
export const s17 = ys[17], s18 = ys[18], s19 = ys[19], s20 = ys[20], s21 = ys[21], s22 = ys[22], s23 = ys[23], s24 = ys[24];
// The same points 1 px lower, for the second pass that makes the line 2 px thick.
const t = ys.map((y) => y + 1);
export const t0 = t[0], t1 = t[1], t2 = t[2], t3 = t[3], t4 = t[4], t5 = t[5], t6 = t[6], t7 = t[7], t8 = t[8];
export const t9 = t[9], t10 = t[10], t11 = t[11], t12 = t[12], t13 = t[13], t14 = t[14], t15 = t[15], t16 = t[16];
export const t17 = t[17], t18 = t[18], t19 = t[19], t20 = t[20], t21 = t[21], t22 = t[22], t23 = t[23], t24 = t[24];
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 28, "#1C1C1C"],
  ["fillCircle", 18, 14, 9, "#F7931A"],
  ["text", "B", 18, 15, 2, 1, "MC", "#FFFFFF"],
  ["text", "BITCOIN", 34, 14, 2, 1, "ML", "#F7931A"],
  ["text", "BTC/AUD  {clock}", 310, 14, 2, 1, "MR", "#A0A0A0"],
  // Price
  ["text", "{price_txt}", 10, 38, 4, 2, "TL", "#FFFFFF"],
  // 24 h change
  ["fillTriangle", 10, "{arr_base}", 26, "{arr_base}", 18, "{arr_tip}", "{col}"],
  ["text", "{chg}", 32, 113, 4, 1, "ML", "{col}"],
  // High / low
  ["text", "{high}", 310, 104, 2, 1, "MR", "#D0D0D0"],
  ["text", "{low}", 310, 122, 2, 1, "MR", "#D0D0D0"],
  // Sparkline card
  ["fillRoundRect", 8, 136, 304, 96, 8, "#141414"],
  ["text", "{chart_label}", 14, 141, 1, 1, "TL", "#707070"],
  // Guide at the price 24 h ago
  ["drawFastHLine", px(0), "{open_y}", px(N) - px(0), "#383838"],
  // Each segment twice (s and t = s + 1) for a 2 px line that reads from across a room.
  ...Array.from({ length: N }, (_, i): RawWireOp[] => [
    ["drawLine", px(i), `{s${i}}`, px(i + 1), `{s${i + 1}}`, "{col}"],
    ["drawLine", px(i), `{t${i}}`, px(i + 1), `{t${i + 1}}`, "{col}"],
  ]).flat(),
];

const template: Template = {
  id: "bitcoin-ticker",
  name: "Bitcoin ticker",
  description: "Bitcoin in AUD: big price, 24-hour change with arrow, high and low, and a 24-hour sparkline.",
  apis: ["CoinGecko"],
  category: "finance",
  dataCode: code,
  rows: rows("bitcoin-ticker", wire),
  sampleVars: {"arr_base":104,"arr_tip":122,"chart_label":"24H","chg":"-2.72%","clock":"01:01","col":"#FF5A5F","high":"H $95,301","low":"L $91,991","open_y":156,"price_txt":"$92,682","s0":156,"s1":160,"s10":201,"s11":199,"s12":213,"s13":200,"s14":209,"s15":222,"s16":211,"s17":213,"s18":216,"s19":214,"s2":175,"s20":213,"s21":207,"s22":216,"s23":220,"s24":213,"s3":190,"s4":183,"s5":183,"s6":199,"s7":209,"s8":214,"s9":199,"t0":157,"t1":161,"t10":202,"t11":200,"t12":214,"t13":201,"t14":210,"t15":223,"t16":212,"t17":214,"t18":217,"t19":215,"t2":176,"t20":214,"t21":208,"t22":217,"t23":221,"t24":214,"t3":191,"t4":184,"t5":184,"t6":200,"t7":210,"t8":215,"t9":200},
};

export default template;
