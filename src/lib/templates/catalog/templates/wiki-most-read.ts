import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Wikipedia's most-read articles

const ROW_Y = [30, 65, 100, 135, 170, 205]; // top of each row (35 px each)

const code = String.raw`// The six most-read English Wikipedia articles, from the Wikimedia REST featured feed (free, no key).
// The feed for a UTC date carries "mostread" for the day before, but only once that day's stats are
// in, so early in the UTC day it is missing: then yesterday's feed is used instead.
// Main_Page, Special: pages and other non-article pages are skipped.
const COUNT = 6;
const TITLE_W = 216; // px for a title (x 36..252), leaving room for the views on the right
const DESC_W = 276; // px for the description line in font 1 (x 36..312)

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "/");
const feed = async (ms, cache) => {
  try {
    const res = await get("https://en.wikipedia.org/api/rest_v1/feed/featured/" + ymd(ms), { cache });
    return res && res.mostread && Array.isArray(res.mostread.articles) ? res.mostread : null;
  } catch (e) {
    console.log("wikipedia most read failed:", e.message);
    return null;
  }
};
const t = Date.now();
const mostread = (await feed(t, 3600)) || (await feed(t - 86400000, 21600));

// Fonts are ASCII only: drop accents, straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "D").replace(/đ/g, "d").replace(/Ł/g, "L").replace(/ł/g, "l")
    .replace(/Ø/g, "O").replace(/ø/g, "o").replace(/ß/g, "ss").replace(/Æ/g, "AE").replace(/æ/g, "ae")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Font 2 glyph widths (chars 32-126) so titles are cut to real pixels.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width2 = (s) => { let w = 0; for (const c of s) w += W2[c.charCodeAt(0) - 32] || 8; return w; };
const fit2 = (s, max) => {
  if (width2(s) <= max) return s;
  let out = s;
  while (out && width2(out + "...") > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
};
// Font 1 is a fixed 6 px per character.
const fit1 = (s, max) => {
  const n = Math.floor(max / 6);
  return s.length <= n ? s : s.slice(0, n - 3).replace(/[\s,;:.-]+$/, "") + "...";
};
const views = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M"
  : n >= 1e3 ? Math.round(n / 1e3) + "k"
  : String(n);

const skip = (a) => !a || (a.namespace && a.namespace.id !== 0) || /^(Main_Page|Special:)/.test(a.title || "");
const list = mostread ? mostread.articles.filter((a) => !skip(a)).slice(0, COUNT) : [];

const out = {};
for (let i = 0; i < COUNT; i++) {
  const a = list[i];
  const n = i + 1;
  out["r" + n] = a ? String(n) : "";
  out["t" + n] = a ? fit2(ascii((a.titles && a.titles.normalized) || a.title.replace(/_/g, " ")), TITLE_W) : "";
  out["d" + n] = a ? fit1(ascii(a.description), DESC_W) : "";
  out["v" + n] = a ? views(a.views || 0) : "";
}
if (!list.length) out.t1 = "Couldn't load Wikipedia";
if (!list.length) out.d1 = "Trying again soon";

export const r1 = out.r1, t1 = out.t1, d1 = out.d1, v1 = out.v1;
export const r2 = out.r2, t2 = out.t2, d2 = out.d2, v2 = out.v2;
export const r3 = out.r3, t3 = out.t3, d3 = out.d3, v3 = out.v3;
export const r4 = out.r4, t4 = out.t4, d4 = out.d4, v4 = out.v4;
export const r5 = out.r5, t5 = out.t5, d5 = out.d5, v5 = out.v5;
export const r6 = out.r6, t6 = out.t6, d6 = out.d6, v6 = out.v6;

// The day the views were counted, e.g. "Thu 19 Nov".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dd = mostread && mostread.date ? new Date(mostread.date.slice(0, 10) + "T00:00:00Z") : null;
export const day = dd && !isNaN(dd) ? DAYS[dd.getUTCDay()] + " " + dd.getUTCDate() + " " + MONTHS[dd.getUTCMonth()] : "";
`;

const ACCENT = "#6FB0F0";

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#2A2A2A"],
  ["text", "Wikipedia - Most read", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{day}", 312, 13, 2, 1, "MR", "#A0A0A0"],
  ...[1, 2, 3, 4, 5].map((n): RawWireOp => ["drawFastHLine", 8, ROW_Y[n] - 3, 304, "#303030"]),
  ...[1, 2, 3, 4, 5, 6].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      ["text", `{r${n}}`, 18, y + 2, 4, 1, "TC", ACCENT],
      ["text", `{t${n}}`, 36, y, 2, 1, "TL", "#FFFFFF"],
      ["text", `{v${n}}`, 312, y, 2, 1, "TR", ACCENT],
      ["text", `{d${n}}`, 36, y + 18, 1, 1, "TL", "#8C8C8C"],
    ];
  }),
];

const template: Template = {
  id: "wiki-most-read",
  name: "Wikipedia most read",
  description: "The six most-read English Wikipedia articles of the day, with a short description and view counts.",
  apis: ["Wikipedia"],
  category: "news",
  dataCode: code,
  rows: rows("wiki-most-read", wire),
  sampleVars: {"d1":"2026 video game","d2":"2026 Indian film by Nitesh Tiwari","d3":"American musician (born 1979)","d4":"American country singer-songwriter (born 1999)","d5":"American criminal and murder victim (1934-1...","d6":"English actor (born 1986)","day":"Thu 19 Nov","r1":"1","r2":"2","r3":"3","r4":"4","r5":"5","r6":"6","t1":"Grand Theft Auto VI","t2":"Ramayana: Part 1","t3":"Stephen Wilson Jr.","t4":"Ella Langley","t5":"Ken McElroy","t6":"Robert Pattinson","v1":"750k","v2":"372k","v3":"328k","v4":"189k","v5":"173k","v6":"173k"},
};

export default template;
