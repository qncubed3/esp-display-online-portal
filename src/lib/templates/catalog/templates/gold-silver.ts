import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Gold and silver spot prices in AUD

const TILE_Y = [34, 126]; // top of each 86 px tile
const TILE_H = 86;

const code = String.raw`// Gold and silver spot prices per troy ounce, from gold-api.com (free, no key).
// Change CUR to another currency code (USD, EUR, GBP...) and SYM to its symbol.
const CUR = "AUD";
const SYM = "A$";
const GRAMS_PER_OZ = 31.1035;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The API is sometimes slow, so try each metal twice.
async function price(sym) {
  for (let i = 0; i < 2; i++) {
    try {
      const d = await get("https://api.gold-api.com/price/" + sym + "/" + CUR, { cache: 600 });
      if (typeof d.price === "number" && d.price > 0) return d;
    } catch (e) {
      console.log("gold-api " + sym + ": " + e.message);
    }
  }
  return null;
}

const both = await Promise.all([price("XAU"), price("XAG")]);
const gold = both[0];
const silver = both[1];

function commas(s) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function money(v) {
  if (v >= 1000) return SYM + commas(Math.round(v).toString());
  const p = v.toFixed(2).split(".");
  return SYM + commas(p[0]) + "." + p[1];
}

// Owner's UTC offset, worked out from now() so update times show in local time.
const n = now("YYYY-MM-DD HH:mm").split(/[- :]/).map(Number);
const localMs = Date.UTC(n[0], n[1] - 1, n[2], n[3], n[4]);
const offset = Math.round((localMs - Date.now()) / 900000) * 900000;
const today = now("YYYY-MM-DD");

function when(iso) {
  const t = Date.parse(iso || "");
  if (!isFinite(t)) return "";
  const d = new Date(t + offset);
  const p2 = (x) => (x < 10 ? "0" : "") + x;
  const hm = p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes());
  const ymd = d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate());
  return ymd === today ? "at " + hm : DAYS[d.getUTCDay()] + " " + hm;
}

export const time = now("HH:mm");
export const unit = CUR + " per troy oz";
export const gold_price = gold ? money(gold.price) : "--";
export const gold_gram = gold ? money(gold.price / GRAMS_PER_OZ) + "/g" : "";
export const gold_upd = gold ? when(gold.updatedAt) : "No data";
export const silver_price = silver ? money(silver.price) : "--";
export const silver_gram = silver ? money(silver.price / GRAMS_PER_OZ) + "/g" : "";
export const silver_upd = silver ? when(silver.updatedAt) : "No data";
export const ratio = gold && silver ? "Gold/silver ratio  " + (gold.price / silver.price).toFixed(1) : "";
`;

const tile = (y: number, name: string, accent: string, tint: string, v: string): RawWireOp[] => [
  ["fillRoundRect", 6, y, 308, TILE_H, 6, tint],
  ["fillRoundRect", 6, y, 8, TILE_H, 4, accent],
  ["text", name, 24, y + 9, 2, 1, "TL", accent],
  ["text", `{${v}_upd}`, 306, y + 9, 2, 1, "TR", "#9AA3AD"],
  ["text", `{${v}_price}`, 24, y + 80, 4, 2, "BL", "#FFFFFF"],
  ["text", `{${v}_gram}`, 306, y + 78, 2, 1, "BR", "#9AA3AD"],
];

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#2A2210"],
  ["text", "Gold & Silver", 8, 14, 2, 1, "ML", "#F5C542"],
  ["text", "{unit}", 160, 14, 1, 1, "MC", "#B8AE95"],
  ["text", "{time}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  ...tile(TILE_Y[0], "GOLD  XAU", "#F5C542", "#1E1A0C", "gold"),
  ...tile(TILE_Y[1], "SILVER  XAG", "#C8CDD3", "#16191C", "silver"),
  ["text", "{ratio}", 160, 228, 2, 1, "MC", "#B8AE95"],
];

const template: Template = {
  id: "gold-silver",
  name: "Gold and silver (AUD)",
  description: "Gold and silver spot prices in AUD per ounce and per gram, with the gold/silver ratio.",
  apis: ["Gold API"],
  category: "finance",
  dataCode: code,
  rows: rows("gold-silver", wire),
  sampleVars: {"gold_gram": "A$172.04/g", "gold_price": "A$5,351", "gold_upd": "at 01:12", "ratio": "Gold/silver ratio  85.0", "silver_gram": "A$2.02/g", "silver_price": "A$62.98", "silver_upd": "at 01:12", "time": "01:12", "unit": "AUD per troy oz"},
};

export default template;
