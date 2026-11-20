import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// AUD exchange rates

const ROW_Y = [32, 66, 100, 134, 168, 202]; // top of each 34 px row

const forexCode = String.raw`// 1 AUD in six currencies with the change since the previous business day.
// Frankfurter v2 (free, no key) with the ECB reference rates, published once per working day.
// Change BASE and the codes/names in CUR to suit (keep six rows).
const BASE = "AUD";
const CUR = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "UK Pound" },
  { code: "JPY", name: "Yen" },
  { code: "NZD", name: "NZ Dollar" },
  { code: "CNY", name: "Yuan" },
];
const ROW_Y = [32, 66, 100, 134, 168, 202]; // top of each row in Draw (keep in step with the Draw rows)
const HIDE = -200; // y for arrows that should not show
const UP = "#3ECF8E", DOWN = "#FF5A5F", FLAT = "#A0A0A0";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Ask for the last 10 days so the latest and the previous business day are both in one call.
const t = now("YYYY-MM-DD").split("-").map(Number);
const from = new Date(Date.UTC(t[0], t[1] - 1, t[2] - 10)).toISOString().slice(0, 10);

let series = {}; // code -> [{ date, rate }] oldest first
let latest = "";
try {
  const data = await get(
    "https://api.frankfurter.dev/v2/rates?providers=ECB&base=" + BASE + "&from=" + from +
      "&quotes=" + CUR.map((c) => c.code).join(","),
    { cache: 3600 },
  );
  for (const r of data) {
    (series[r.quote] = series[r.quote] || []).push({ date: r.date, rate: r.rate });
    if (r.date > latest) latest = r.date;
  }
  for (const k in series) series[k].sort((a, b) => (a.date < b.date ? -1 : 1));
} catch (e) {
  console.log("forex: " + e.message);
}

function fmtRate(v) {
  if (typeof v !== "number") return "--";
  return v.toFixed(v >= 100 ? 2 : v >= 10 ? 3 : 4);
}

function row(i) {
  const c = CUR[i];
  const s = series[c.code] || [];
  const cur = s[s.length - 1], prev = s[s.length - 2];
  const cy = ROW_Y[i] + 17;
  const out = { code: c.code, name: c.name, rate: fmtRate(cur && cur.rate), chg: "", col: FLAT, base: HIDE, tip: HIDE };
  if (cur && prev && prev.rate) {
    const pct = (cur.rate / prev.rate - 1) * 100;
    const r = Math.round(pct * 100) / 100;
    out.chg = (r > 0 ? "+" : "") + r.toFixed(2) + "%";
    if (r > 0) Object.assign(out, { col: UP, base: cy + 5, tip: cy - 5 });
    else if (r < 0) Object.assign(out, { col: DOWN, base: cy - 5, tip: cy + 5 });
    else out.chg = "0.00%";
  }
  return out;
}

const r = [0, 1, 2, 3, 4, 5].map(row);
export const r1_code = r[0].code, r1_name = r[0].name, r1_rate = r[0].rate, r1_chg = r[0].chg, r1_col = r[0].col, r1_base = r[0].base, r1_tip = r[0].tip;
export const r2_code = r[1].code, r2_name = r[1].name, r2_rate = r[1].rate, r2_chg = r[1].chg, r2_col = r[1].col, r2_base = r[1].base, r2_tip = r[1].tip;
export const r3_code = r[2].code, r3_name = r[2].name, r3_rate = r[2].rate, r3_chg = r[2].chg, r3_col = r[2].col, r3_base = r[2].base, r3_tip = r[2].tip;
export const r4_code = r[3].code, r4_name = r[3].name, r4_rate = r[3].rate, r4_chg = r[3].chg, r4_col = r[3].col, r4_base = r[3].base, r4_tip = r[3].tip;
export const r5_code = r[4].code, r5_name = r[4].name, r5_rate = r[4].rate, r5_chg = r[4].chg, r5_col = r[4].col, r5_base = r[4].base, r5_tip = r[4].tip;
export const r6_code = r[5].code, r6_name = r[5].name, r6_rate = r[5].rate, r6_chg = r[5].chg, r6_col = r[5].col, r6_base = r[5].base, r6_tip = r[5].tip;

export const base = "1 " + BASE;
let label = "No data";
if (latest) {
  const p = latest.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  label = DAYS[d.getUTCDay()] + " " + p[2] + " " + MONTHS[p[1] - 1] + " " + p[0];
}
export const rate_date = label;
`;

const forexWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 30, "#0B2545"],
  ["text", "{base}", 10, 16, 4, 1, "ML", "#FFC940"],
  ["text", "{rate_date}", 310, 16, 2, 1, "MR", "#D0DCEB"],
  ...ROW_Y.flatMap((y, i): RawWireOp[] => {
    const n = i + 1;
    const cy = y + 17;
    return [
      ...(i % 2 === 0 ? ([["fillRect", 0, y, 320, 34, "#121A24"]] as RawWireOp[]) : []),
      ["text", `{r${n}_code}`, 10, cy + 1, 4, 1, "ML", "#FFFFFF"],
      ["text", `{r${n}_name}`, 72, cy + 1, 2, 1, "ML", "#8A9BB0"],
      ["text", `{r${n}_rate}`, 218, cy + 1, 4, 1, "MR", "#FFFFFF"],
      ["fillTriangle", 230, `{r${n}_base}`, 242, `{r${n}_base}`, 236, `{r${n}_tip}`, `{r${n}_col}`],
      ["text", `{r${n}_chg}`, 312, cy + 1, 2, 1, "MR", `{r${n}_col}`],
    ];
  }),
];

const template: Template = {
  id: "forex-aud",
  name: "AUD exchange rates",
  description: "1 AUD in US dollars, euros, pounds, yen, NZ dollars and yuan, with the daily change in green or red.",
  apis: ["Frankfurter"],
  category: "finance",
  dataCode: forexCode,
  rows: rows("forex-aud", forexWire),
  sampleVars: {"base": "1 AUD", "r1_base": 44, "r1_chg": "-0.30%", "r1_code": "USD", "r1_col": "#FF5A5F", "r1_name": "US Dollar", "r1_rate": "0.6711", "r1_tip": 54, "r2_base": 78, "r2_chg": "-0.51%", "r2_code": "EUR", "r2_col": "#FF5A5F", "r2_name": "Euro", "r2_rate": "0.6106", "r2_tip": 88, "r3_base": 112, "r3_chg": "-0.17%", "r3_code": "GBP", "r3_col": "#FF5A5F", "r3_name": "UK Pound", "r3_rate": "0.5103", "r3_tip": 122, "r4_base": 156, "r4_chg": "+0.05%", "r4_code": "JPY", "r4_col": "#3ECF8E", "r4_name": "Yen", "r4_rate": "107.36", "r4_tip": 146, "r5_base": 180, "r5_chg": "-0.82%", "r5_code": "NZD", "r5_col": "#FF5A5F", "r5_name": "NZ Dollar", "r5_rate": "1.2144", "r5_tip": 190, "r6_base": 214, "r6_chg": "-0.30%", "r6_code": "CNY", "r6_col": "#FF5A5F", "r6_name": "Yuan", "r6_rate": "4.4743", "r6_tip": 224, "rate_date": "Thu 19 Nov 2026"},
};

export default template;
