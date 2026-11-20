import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Crypto prices

const cryptoCode = String.raw`// Three coin prices with 24 h change from CoinGecko (free, no key; keep cache >= 60 s).
// Change COINS (CoinGecko ids) and CURRENCY to suit.
const CURRENCY = "aud";
const COINS = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin", letter: "B", col: "#F7931A" },
  { id: "ethereum", sym: "ETH", name: "Ethereum", letter: "E", col: "#627EEA" },
  { id: "solana", sym: "SOL", name: "Solana", letter: "S", col: "#9945FF" },
];
const ROW_Y = [34, 102, 170]; // top of each card in Draw

const prices = await get(
  "https://api.coingecko.com/api/v3/simple/price?ids=" + COINS.map((c) => c.id).join(",") +
    "&vs_currencies=" + CURRENCY + "&include_24hr_change=true",
  { cache: 120 },
);

function money(v) {
  if (typeof v !== "number") return "--";
  const [int, frac] = v.toFixed(v >= 1000 ? 0 : v >= 1 ? 2 : 4).split(".");
  return "$" + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "");
}

function coin(i) {
  const c = COINS[i];
  const p = prices[c.id] || {};
  const chg = p[CURRENCY + "_24h_change"];
  const up = typeof chg === "number" && chg >= 0;
  const y = ROW_Y[i];
  return {
    sym: c.sym, name: c.name, letter: c.letter, col: c.col,
    price: money(p[CURRENCY]),
    chg: typeof chg === "number" ? (up ? "+" : "") + chg.toFixed(2) + "%" : "",
    chgCol: up ? "#3ECF8E" : "#FF5A5F",
    // Arrow triangle: base and tip y (pointing up or down).
    base: typeof chg !== "number" ? -200 : up ? y + 53 : y + 44,
    tip: typeof chg !== "number" ? -200 : up ? y + 44 : y + 53,
  };
}
const a = coin(0), b = coin(1), c = coin(2);
export const c1_sym = a.sym, c1_name = a.name, c1_letter = a.letter, c1_col = a.col, c1_price = a.price, c1_chg = a.chg, c1_chg_col = a.chgCol, c1_base = a.base, c1_tip = a.tip;
export const c2_sym = b.sym, c2_name = b.name, c2_letter = b.letter, c2_col = b.col, c2_price = b.price, c2_chg = b.chg, c2_chg_col = b.chgCol, c2_base = b.base, c2_tip = b.tip;
export const c3_sym = c.sym, c3_name = c.name, c3_letter = c.letter, c3_col = c.col, c3_price = c.price, c3_chg = c.chg, c3_chg_col = c.chgCol, c3_base = c.base, c3_tip = c.tip;
export const currency = CURRENCY.toUpperCase();
export const clock = now("HH:mm");
`;

const cryptoWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#202020"],
  ["setTextSize", 1],
  ["setTextDatum", "ML"],
  ["setTextColor", "#FFA500"],
  ["drawString", "CRYPTO", 8, 14, 2],
  ["setTextDatum", "MR"],
  ["setTextColor", "#A0A0A0"],
  ["drawString", "{currency}  {clock}", 312, 14, 2],
  ...[1, 2, 3].flatMap((n): RawWireOp[] => {
    const y = [34, 102, 170][n - 1];
    return [
      ["fillRoundRect", 8, y, 304, 64, 8, "#181818"],
      ["fillCircle", 34, y + 32, 17, `{c${n}_col}`],
      ["setTextDatum", "MC"],
      ["setTextColor", "#FFFFFF"],
      ["drawString", `{c${n}_letter}`, 34, y + 33, 4],
      ["setTextDatum", "TL"],
      ["drawString", `{c${n}_sym}`, 62, y + 10, 4],
      ["setTextColor", "#A0A0A0"],
      ["drawString", `{c${n}_name}`, 63, y + 42, 1],
      ["setTextDatum", "TR"],
      ["setTextColor", "#FFFFFF"],
      ["drawString", `{c${n}_price}`, 302, y + 10, 4],
      ["setTextColor", `{c${n}_chg_col}`],
      ["drawString", `{c${n}_chg}`, 302, y + 40, 2],
      ["fillTriangle", 224, `{c${n}_base}`, 234, `{c${n}_base}`, 229, `{c${n}_tip}`, `{c${n}_chg_col}`],
    ];
  }),
];

const template: Template = {
  id: "crypto",
  name: "Crypto prices",
  description: "Bitcoin, Ethereum and Solana in AUD with 24-hour change, green up and red down.",
  apis: ["CoinGecko"],
  category: "finance",
  dataCode: cryptoCode,
  rows: rows("crypto", cryptoWire),
  sampleVars: {"c1_base": 78, "c1_chg": "-2.80%", "c1_chg_col": "#FF5A5F", "c1_col": "#F7931A", "c1_letter": "B", "c1_name": "Bitcoin", "c1_price": "$92,701", "c1_sym": "BTC", "c1_tip": 87, "c2_base": 146, "c2_chg": "-2.77%", "c2_chg_col": "#FF5A5F", "c2_col": "#627EEA", "c2_letter": "E", "c2_name": "Ethereum", "c2_price": "$2,622", "c2_sym": "ETH", "c2_tip": 155, "c3_base": 214, "c3_chg": "-3.46%", "c3_chg_col": "#FF5A5F", "c3_col": "#9945FF", "c3_letter": "S", "c3_name": "Solana", "c3_price": "$107.78", "c3_sym": "SOL", "c3_tip": 223, "clock": "22:50", "currency": "AUD"},
};

export default template;
