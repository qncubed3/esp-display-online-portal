import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Bitcoin network: block height and age, mempool size, fee tiers as bars,
// price in two currencies and the next difficulty adjustment.

const BAR_X = 96; // left of the fee bars
const FEE_Y = [122, 138, 154, 170]; // row centres

const code = String.raw`// Bitcoin network stats from mempool.space (free, no key, no stated limit: be reasonable).
// Blocks, fees and mempool are cached 60 s, prices 120 s, the difficulty estimate 600 s.
const CUR2 = "AUD"; // second price currency: USD, EUR, GBP, CAD, CHF, AUD or JPY
const BAR_W = 150; // longest fee bar in px (the fastest fee)
const UP = "#3ECF8E", DOWN = "#FF5A5F", FLAT = "#A0A0A0";
const BASE = "https://mempool.space/api/";

function grp(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function money(v) {
  return typeof v === "number" && isFinite(v) && v > 0 ? "$" + grp(v) : "--";
}
function fee(v) {
  if (typeof v !== "number" || !isFinite(v)) return "--";
  return v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}
async function load(path, cache) {
  try {
    return await get(BASE + path, { cache: cache });
  } catch (e) {
    console.log(path + " failed: " + e);
    return null;
  }
}

const blocks = await load("blocks", 60);
const fees = await load("v1/fees/recommended", 60);
const pool = await load("mempool", 60);
const prices = await load("v1/prices", 120);
const diff = await load("v1/difficulty-adjustment", 600);

// Latest block
const tip = Array.isArray(blocks) && blocks.length ? blocks[0] : null;
export const height = tip && typeof tip.height === "number" ? grp(tip.height) : "No data";
let age = "";
if (tip && typeof tip.timestamp === "number") {
  const mins = Math.max(0, Math.floor((Date.now() / 1000 - tip.timestamp) / 60));
  age = mins < 1 ? "just now" : mins < 60 ? mins + " min ago" : Math.floor(mins / 60) + "h " + (mins % 60) + "m ago";
}
export const block_age = age;
export const block_tx = tip && typeof tip.tx_count === "number" ? grp(tip.tx_count) + " tx" : "";
export const mempool_tx = pool && typeof pool.count === "number" ? grp(pool.count) + " pending" : "";

// Fee tiers (sat/vB), bars scaled to the fastest tier.
const f = fees || {};
const tiers = [f.fastestFee, f.halfHourFee, f.hourFee, f.economyFee];
const top = Math.max.apply(null, tiers.filter((v) => typeof v === "number" && v > 0).concat([1]));
const w = tiers.map((v) => (typeof v === "number" && v > 0 ? Math.max(4, Math.round((v / top) * BAR_W)) : 0));
export const f1 = fee(tiers[0]), f2 = fee(tiers[1]), f3 = fee(tiers[2]), f4 = fee(tiers[3]);
export const w1 = w[0], w2 = w[1], w3 = w[2], w4 = w[3];

// Prices
const p = prices || {};
export const usd = money(p.USD);
export const cur2 = money(p[CUR2]);
export const cur2_label = "BTC/" + CUR2;

// Next difficulty adjustment
let adj = "--", adjCol = FLAT, adjLabel = "DIFFICULTY";
if (diff && typeof diff.difficultyChange === "number") {
  const c = diff.difficultyChange;
  adj = (c >= 0 ? "+" : "") + c.toFixed(1) + "%";
  adjCol = c > 0 ? UP : c < 0 ? DOWN : FLAT;
  if (typeof diff.remainingTime === "number") {
    const d = diff.remainingTime / 86400000;
    adjLabel = "DIFF ADJ IN " + (d >= 1 ? d.toFixed(1) + "D" : Math.round(d * 24) + "H");
  }
}
export const adj_txt = adj;
export const adj_col = adjCol;
export const adj_label = adjLabel;
export const clock = now("HH:mm");
`;

const ORANGE = "#F7931A";
const LABELS = ["Fastest", "30 min", "1 hour", "Economy"];

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 28, "#1C1C1C"],
  ["fillCircle", 18, 14, 9, ORANGE],
  ["text", "B", 18, 15, 2, 1, "MC", "#FFFFFF"],
  ["text", "BITCOIN NETWORK", 34, 14, 2, 1, "ML", ORANGE],
  ["text", "{clock}", 310, 14, 2, 1, "MR", "#A0A0A0"],
  // Block height (big) with the latest block's age, tx count and mempool size on the right
  ["text", "BLOCK HEIGHT", 10, 36, 1, 1, "TL", "#808080"],
  ["text", "{height}", 8, 46, 4, 2, "TL", "#FFFFFF"],
  ["text", "{block_age}", 310, 40, 2, 1, "TR", ORANGE],
  ["text", "{block_tx}", 310, 58, 2, 1, "TR", "#D0D0D0"],
  ["text", "{mempool_tx}", 310, 76, 2, 1, "TR", "#D0D0D0"],
  // Fee card
  ["fillRoundRect", 8, 100, 304, 82, 8, "#141414"],
  ["text", "FEES", 16, 106, 1, 1, "TL", "#808080"],
  ["text", "sat/vB", 304, 106, 1, 1, "TR", "#808080"],
  ...FEE_Y.flatMap((y, i): RawWireOp[] => [
    ["text", LABELS[i], 16, y, 2, 1, "ML", "#D0D0D0"],
    ["fillRect", BAR_X, y - 5, `{w${i + 1}}`, 10, ORANGE],
    ["text", `{f${i + 1}}`, 304, y, 2, 1, "MR", "#FFFFFF"],
  ]),
  // Prices and difficulty
  ["text", "BTC/USD", 10, 192, 1, 1, "TL", "#808080"],
  ["text", "{usd}", 8, 204, 4, 1, "TL", "#FFFFFF"],
  ["text", "{cur2_label}", 112, 192, 1, 1, "TL", "#808080"],
  ["text", "{cur2}", 110, 204, 4, 1, "TL", "#FFFFFF"],
  ["text", "{adj_label}", 310, 192, 1, 1, "TR", "#808080"],
  ["text", "{adj_txt}", 310, 204, 4, 1, "TR", "{adj_col}"],
];

const template: Template = {
  id: "bitcoin-network",
  name: "Bitcoin network",
  description: "Bitcoin block height, last block age, mempool size, fee tiers as bars, BTC price and the next difficulty adjustment.",
  apis: ["mempool.space"],
  category: "finance",
  dataCode: code,
  rows: rows("bitcoin-network", wire),
  sampleVars: {"adj_col":"#3ECF8E","adj_label":"DIFF ADJ IN 6.6D","adj_txt":"+7.8%","block_age":"4 min ago","block_tx":"3,022 tx","clock":"01:14","cur2":"$92,703","cur2_label":"BTC/AUD","f1":"3","f2":"3","f3":"3","f4":"2","height":"976,734","mempool_tx":"74,694 pending","usd":"$61,877","w1":150,"w2":150,"w3":150,"w4":100},
};

export default template;
