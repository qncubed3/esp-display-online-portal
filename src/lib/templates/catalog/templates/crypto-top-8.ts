import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Top 8 cryptocurrencies by market cap

const TOP = 28; // y of the first row
const ROW_H = 26; // 8 rows fill 28..236

const code = String.raw`// The top 8 coins by market cap with price and 24 h change, from CoinGecko (free, no key).
// CoinGecko's keyless limit is tight, so keep the cache at 180 s or more.
const CURRENCY = "aud"; // any CoinGecko vs_currency
const SIGN = "$"; // shown before prices
const UP = "#3ECF8E", DOWN = "#FF5A5F", FLAT = "#A0A0A0";

let coins = [];
try {
  const data = await get(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=" + CURRENCY +
      "&order=market_cap_desc&per_page=8&page=1&price_change_percentage=24h",
    { cache: 180 },
  );
  if (Array.isArray(data)) coins = data;
} catch (e) {
  console.log("crypto-top-8: " + e.message);
}

// Compact price: $92,697  $853.19  $1.50  $0.4579  $0.0000123  $1.2M
function price(v) {
  if (typeof v !== "number" || !isFinite(v)) return "--";
  if (v >= 1e9) return SIGN + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return SIGN + (v / 1e6).toFixed(2) + "M";
  if (v >= 1000) return SIGN + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (v >= 1) return SIGN + v.toFixed(2);
  if (v >= 0.01) return SIGN + v.toFixed(4);
  if (v <= 0) return SIGN + "0";
  return SIGN + Number(v.toPrecision(3)).toFixed(Math.min(12, 2 - Math.floor(Math.log10(v))));
}

// Compact big total: $2.86T, $412B
function big(v) {
  if (v >= 1e12) return SIGN + (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return SIGN + Math.round(v / 1e9) + "B";
  if (v >= 1e6) return SIGN + Math.round(v / 1e6) + "M";
  return SIGN + Math.round(v);
}

function row(i) {
  const c = coins[i];
  if (!c) return { rank: "", sym: i === 0 ? "No data" : "", price: "", chg: "", col: FLAT };
  const p = typeof c.price_change_percentage_24h_in_currency === "number"
    ? c.price_change_percentage_24h_in_currency
    : c.price_change_percentage_24h;
  let chg = "--", col = FLAT;
  if (typeof p === "number") {
    const r = Math.round(p * 10) / 10;
    chg = (r > 0 ? "+" : "") + r.toFixed(1) + "%";
    col = r > 0 ? UP : r < 0 ? DOWN : FLAT;
  }
  return {
    rank: String(c.market_cap_rank || i + 1),
    sym: String(c.symbol || "?").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5),
    price: price(c.current_price),
    chg,
    col,
  };
}

const r = [0, 1, 2, 3, 4, 5, 6, 7].map(row);
export const r1_rank = r[0].rank, r1_sym = r[0].sym, r1_price = r[0].price, r1_chg = r[0].chg, r1_col = r[0].col;
export const r2_rank = r[1].rank, r2_sym = r[1].sym, r2_price = r[1].price, r2_chg = r[1].chg, r2_col = r[1].col;
export const r3_rank = r[2].rank, r3_sym = r[2].sym, r3_price = r[2].price, r3_chg = r[2].chg, r3_col = r[2].col;
export const r4_rank = r[3].rank, r4_sym = r[3].sym, r4_price = r[3].price, r4_chg = r[3].chg, r4_col = r[3].col;
export const r5_rank = r[4].rank, r5_sym = r[4].sym, r5_price = r[4].price, r5_chg = r[4].chg, r5_col = r[4].col;
export const r6_rank = r[5].rank, r6_sym = r[5].sym, r6_price = r[5].price, r6_chg = r[5].chg, r6_col = r[5].col;
export const r7_rank = r[6].rank, r7_sym = r[6].sym, r7_price = r[6].price, r7_chg = r[6].chg, r7_col = r[6].col;
export const r8_rank = r[7].rank, r8_sym = r[7].sym, r8_price = r[7].price, r8_chg = r[7].chg, r8_col = r[7].col;

let total = 0;
for (const c of coins) if (typeof c.market_cap === "number") total += c.market_cap;
export const title = "TOP 8 " + CURRENCY.toUpperCase();
export const info = (total > 0 ? "Cap " + big(total) + "   " : "") + now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#2A1A00"],
  ["text", "{title}", 8, 13, 2, 1, "ML", "#FFA500"],
  ["text", "{info}", 312, 13, 2, 1, "MR", "#D0D0D0"],
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    const cy = y + ROW_H / 2;
    return [
      ...(i % 2 === 1 ? ([["fillRect", 0, y, 320, ROW_H, "#141414"]] as RawWireOp[]) : []),
      ["text", `{r${n}_rank}`, 22, cy + 1, 2, 1, "MR", "#808080"],
      ["text", `{r${n}_sym}`, 30, cy + 1, 4, 1, "ML", "#FFFFFF"],
      ["text", `{r${n}_price}`, 222, cy + 1, 4, 1, "MR", "#FFFFFF"],
      ["text", `{r${n}_chg}`, 312, cy + 1, 4, 1, "MR", `{r${n}_col}`],
    ];
  }),
];

const template: Template = {
  id: "crypto-top-8",
  name: "Top 8 crypto",
  description: "The eight biggest cryptocurrencies by market cap with AUD price and 24-hour change in green or red.",
  apis: ["CoinGecko"],
  category: "finance",
  dataCode: code,
  rows: rows("crypto-top-8", wire),
  sampleVars: {"info": "Cap $2.86T   14:30", "r1_chg": "-2.8%", "r1_col": "#FF5A5F", "r1_price": "$92,697", "r1_rank": "1", "r1_sym": "BTC", "r2_chg": "-2.7%", "r2_col": "#FF5A5F", "r2_price": "$2,627", "r2_rank": "2", "r2_sym": "ETH", "r3_chg": "+0.6%", "r3_col": "#3ECF8E", "r3_price": "$1.50", "r3_rank": "3", "r3_sym": "USDT", "r4_chg": "-3.4%", "r4_col": "#FF5A5F", "r4_price": "$853.19", "r4_rank": "4", "r4_sym": "BNB", "r5_chg": "+0.6%", "r5_col": "#3ECF8E", "r5_price": "$1.50", "r5_rank": "5", "r5_sym": "USDC", "r6_chg": "-4.0%", "r6_col": "#FF5A5F", "r6_price": "$1.42", "r6_rank": "6", "r6_sym": "XRP", "r7_chg": "-4.6%", "r7_col": "#FF5A5F", "r7_price": "$106.84", "r7_rank": "7", "r7_sym": "SOL", "r8_chg": "-1.6%", "r8_col": "#FF5A5F", "r8_price": "$0.4579", "r8_rank": "8", "r8_sym": "TRX", "title": "TOP 8 AUD"},
};

export default template;
