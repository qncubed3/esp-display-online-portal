import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Four stock market indices with the day's change

const ROW_Y = [32, 82, 132, 182]; // top of each 48 px row

const code = String.raw`// ASX 200, S&P 500, Nasdaq and FTSE 100: last price, day change and whether the market is open.
// Yahoo Finance chart endpoint (unofficial, no key). It can fail or be blocked at any time,
// so every row has its own fallback and the whole screen shows a message if nothing loads.
const IDX = [
  { sym: "^AXJO", name: "ASX 200", city: "Sydney" },
  { sym: "^GSPC", name: "S&P 500", city: "New York" },
  { sym: "^IXIC", name: "Nasdaq", city: "New York" },
  { sym: "^FTSE", name: "FTSE 100", city: "London" },
]; // keep four rows
const ROW_Y = [32, 82, 132, 182]; // top of each row in Draw (keep in step with the Draw rows)
const HIDE = -200;
const UP = "#3ECF8E", DOWN = "#FF5A5F", FLAT = "#A0A0A0";
const OPEN = "#3ECF8E", SHUT = "#8A9BB0";

function fmtPrice(v) {
  const s = v.toFixed(2);
  const p = s.split(".");
  let int = p[0], neg = "";
  if (int[0] === "-") { neg = "-"; int = int.slice(1); }
  let out = "";
  while (int.length > 3) { out = "," + int.slice(-3) + out; int = int.slice(0, -3); }
  return neg + int + out + "." + p[1];
}

async function load(ix) {
  const data = await get(
    "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(ix.sym) + "?interval=1d&range=5d",
    { cache: 300 },
  );
  const r = data && data.chart && data.chart.result && data.chart.result[0];
  const m = r && r.meta;
  if (!m || typeof m.regularMarketPrice !== "number") throw new Error("no price");
  let pct = m.regularMarketChangePercent;
  if (typeof pct !== "number") {
    // Fall back to the last two closes (chartPreviousClose is before the whole range).
    const q = r.indicators && r.indicators.quote && r.indicators.quote[0];
    const closes = ((q && q.close) || []).filter((c) => typeof c === "number");
    const prev = closes.length >= 2 ? closes[closes.length - 2] : null;
    pct = prev ? ((m.regularMarketPrice - prev) / prev) * 100 : null;
  }
  const reg = m.currentTradingPeriod && m.currentTradingPeriod.regular;
  const t = Date.now() / 1000;
  let open = !!(reg && t >= reg.start && t < reg.end);
  if (typeof m.regularMarketTime === "number" && t - m.regularMarketTime > 86400) open = false;
  return { price: m.regularMarketPrice, pct: pct, open: open };
}

let okCount = 0;
const rowsOut = [];
for (let i = 0; i < 4; i++) {
  const ix = IDX[i];
  const y = ROW_Y[i];
  const o = { name: ix.name, city: ix.city, price: "--", status: "No data", stcol: SHUT, chg: "", col: FLAT, pill: HIDE };
  try {
    const d = await load(ix);
    okCount++;
    o.price = fmtPrice(d.price);
    o.status = d.open ? "Open" : "Closed";
    o.stcol = d.open ? OPEN : SHUT;
    if (typeof d.pct === "number" && isFinite(d.pct)) {
      const r = Math.round(d.pct * 100) / 100;
      o.chg = (r > 0 ? "+" : "") + r.toFixed(2) + "%";
      o.col = r > 0 ? UP : r < 0 ? DOWN : FLAT;
      o.pill = y + 13;
    }
  } catch (e) {
    console.log("market-indices " + ix.sym + ": " + e.message);
  }
  rowsOut.push(o);
}

const dead = okCount === 0;
if (dead) for (const o of rowsOut) Object.assign(o, { name: "", city: "", price: "", status: "", chg: "", pill: HIDE });
const r = rowsOut;
export const r1_name = r[0].name, r1_city = r[0].city, r1_price = r[0].price, r1_status = r[0].status, r1_stcol = r[0].stcol, r1_chg = r[0].chg, r1_col = r[0].col, r1_pill = r[0].pill;
export const r2_name = r[1].name, r2_city = r[1].city, r2_price = r[1].price, r2_status = r[1].status, r2_stcol = r[1].stcol, r2_chg = r[1].chg, r2_col = r[1].col, r2_pill = r[1].pill;
export const r3_name = r[2].name, r3_city = r[2].city, r3_price = r[2].price, r3_status = r[2].status, r3_stcol = r[2].stcol, r3_chg = r[2].chg, r3_col = r[2].col, r3_pill = r[2].pill;
export const r4_name = r[3].name, r4_city = r[3].city, r4_price = r[3].price, r4_status = r[3].status, r4_stcol = r[3].stcol, r4_chg = r[3].chg, r4_col = r[3].col, r4_pill = r[3].pill;

// Row stripes go off screen when the error message shows.
export const stripe1 = dead ? HIDE : ROW_Y[0];
export const stripe3 = dead ? HIDE : ROW_Y[2];
export const err1 = dead ? "Market data unavailable" : "";
export const err2 = dead ? "Yahoo Finance did not respond." : "";
export const err3 = dead ? "Trying again in a few minutes." : "";
export const clock = now("ddd HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#0B2545"],
  ["text", "Markets", 10, 14, 4, 1, "ML", "#FFC940"],
  ["text", "{clock}", 310, 14, 2, 1, "MR", "#D0DCEB"],
  ["fillRect", 0, "{stripe1}", 320, 48, "#121A24"],
  ["fillRect", 0, "{stripe3}", 320, 48, "#121A24"],
  ...ROW_Y.flatMap((y, i): RawWireOp[] => {
    const n = i + 1;
    return [
      ["text", `{r${n}_name}`, 10, y + 16, 2, 1, "ML", "#FFFFFF"],
      ["text", `{r${n}_city}`, 10, y + 35, 1, 1, "ML", "#8A9BB0"],
      ["text", `{r${n}_status}`, 66, y + 35, 1, 1, "ML", `{r${n}_stcol}`],
      ["text", `{r${n}_price}`, 226, y + 25, 4, 1, "MR", "#FFFFFF"],
      ["fillRoundRect", 236, `{r${n}_pill}`, 76, 22, 5, `{r${n}_col}`],
      ["text", `{r${n}_chg}`, 274, y + 25, 2, 1, "MC", "#000000"],
    ];
  }),
  ["text", "{err1}", 160, 110, 4, 1, "MC", "#FF5A5F"],
  ["text", "{err2}", 160, 140, 2, 1, "MC", "#D0DCEB"],
  ["text", "{err3}", 160, 160, 2, 1, "MC", "#8A9BB0"],
];

const template: Template = {
  id: "market-indices",
  name: "Market indices",
  description: "ASX 200, S&P 500, Nasdaq and FTSE 100 with the last price, the day's change in a green or red pill, and whether each market is open.",
  apis: ["Yahoo Finance"],
  category: "finance",
  dataCode: code,
  rows: rows("market-indices", wire),
  sampleVars: {"clock":"Sat 01:16","err1":"","err2":"","err3":"","r1_chg":"-1.58%","r1_city":"Sydney","r1_col":"#FF5A5F","r1_name":"ASX 200","r1_pill":45,"r1_price":"8,592.60","r1_status":"Closed","r1_stcol":"#8A9BB0","r2_chg":"-2.02%","r2_city":"New York","r2_col":"#FF5A5F","r2_name":"S&P 500","r2_pill":95,"r2_price":"7,175.83","r2_status":"Closed","r2_stcol":"#8A9BB0","r3_chg":"-2.25%","r3_city":"New York","r3_col":"#FF5A5F","r3_name":"Nasdaq","r3_pill":145,"r3_price":"23,879.20","r3_status":"Closed","r3_stcol":"#8A9BB0","r4_chg":"-0.93%","r4_city":"London","r4_col":"#FF5A5F","r4_name":"FTSE 100","r4_pill":195,"r4_price":"10,354.92","r4_status":"Open","r4_stcol":"#3ECF8E","stripe1":32,"stripe3":132},
};

export default template;
