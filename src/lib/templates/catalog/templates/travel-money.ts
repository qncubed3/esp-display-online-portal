import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Travel money: what a set amount of Australian dollars buys abroad

const ROW_Y = [32, 66, 100, 134, 168, 202]; // top of each 34 px row

const code = String.raw`// What A$100 buys in six popular travel currencies.
// fawazahmed0 currency-api via the jsDelivr CDN (free, no key), updated daily.
// Change AMOUNT, BASE and the codes/places in CUR to suit (keep six rows).
const AMOUNT = 100;
const BASE = "aud";
const BASE_LABEL = "A$"; // shown before AMOUNT in the header
const CUR = [
  { code: "THB", place: "Thailand" },
  { code: "JPY", place: "Japan" },
  { code: "VND", place: "Vietnam" },
  { code: "IDR", place: "Bali" },
  { code: "USD", place: "USA" },
  { code: "EUR", place: "Europe" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let rates = null;
let date = "";
try {
  const data = await get(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/" + BASE + ".json",
    { cache: 21600 },
  );
  rates = data[BASE] || null;
  date = data.date || "";
} catch (e) {
  console.log("travel-money: " + e.message);
}

function commas(n) {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return out;
}

function fmt(v) {
  if (typeof v !== "number" || !isFinite(v)) return "--";
  if (v >= 1000) return commas(Math.round(v));
  if (v >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

const r = CUR.map((c) => {
  const rate = rates && rates[c.code.toLowerCase()];
  return { code: c.code, place: c.place, amt: fmt(typeof rate === "number" ? rate * AMOUNT : null) };
});

export const r1_code = r[0].code, r1_place = r[0].place, r1_amt = r[0].amt;
export const r2_code = r[1].code, r2_place = r[1].place, r2_amt = r[1].amt;
export const r3_code = r[2].code, r3_place = r[2].place, r3_amt = r[2].amt;
export const r4_code = r[3].code, r4_place = r[3].place, r4_amt = r[3].amt;
export const r5_code = r[4].code, r5_place = r[4].place, r5_amt = r[4].amt;
export const r6_code = r[5].code, r6_place = r[5].place, r6_amt = r[5].amt;

export const title = BASE_LABEL + commas(AMOUNT) + " buys";
let label = "No data";
if (date) {
  const p = date.split("-").map(Number);
  label = "Rates " + p[2] + " " + MONTHS[p[1] - 1];
}
export const rate_date = label;
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 30, "#0E3B3A"],
  ["text", "{title}", 10, 16, 4, 1, "ML", "#FFC940"],
  ["text", "{rate_date}", 310, 16, 2, 1, "MR", "#CFE8E6"],
  ...ROW_Y.flatMap((y, i): RawWireOp[] => {
    const n = i + 1;
    const cy = y + 18;
    return [
      ...(i % 2 === 0 ? ([["fillRect", 0, y, 320, 34, "#11201F"]] as RawWireOp[]) : []),
      ["text", `{r${n}_code}`, 10, cy, 4, 1, "ML", "#3ED6C4"],
      ["text", `{r${n}_place}`, 74, cy, 2, 1, "ML", "#8A9BB0"],
      ["text", `{r${n}_amt}`, 310, cy, 4, 1, "MR", "#FFFFFF"],
    ];
  }),
];

const template: Template = {
  id: "travel-money",
  name: "Travel money",
  description: "What A$100 buys in Thai baht, yen, dong, rupiah, US dollars and euros, with the place to spend it.",
  apis: ["currency-api"],
  category: "finance",
  dataCode: code,
  rows: rows("travel-money", wire),
  sampleVars: {"r1_amt":"2,275","r1_code":"THB","r1_place":"Thailand","r2_amt":"10,682","r2_code":"JPY","r2_place":"Japan","r3_amt":"1,722,657","r3_code":"VND","r3_place":"Vietnam","r4_amt":"1,222,157","r4_code":"IDR","r4_place":"Bali","r5_amt":"66.95","r5_code":"USD","r5_place":"USA","r6_amt":"61.04","r6_code":"EUR","r6_place":"Europe","rate_date":"Rates 19 Nov","title":"A$100 buys"},
};

export default template;
