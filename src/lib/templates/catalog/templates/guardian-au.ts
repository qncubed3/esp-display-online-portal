import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Guardian Australia front page: five headlines, each with a red section kicker inline
// (Guardian style) and its publish time, on a white page under a navy masthead.

const ROW_Y = [31, 72, 113, 154, 195]; // top of each headline row (41 px each)

const code = String.raw`// Five latest Guardian Australia headlines from its RSS feed, each with a section kicker
// (from the item's categories) and the time it was published, in your timezone.
const FEED = "https://www.theguardian.com/australia-news/rss";
const COUNT = 5;
const X0 = 8, X1 = 312;          // text runs from x 8 to 312
const LINE1_W = X1 - X0;         // first line, shared with the kicker
const LINE2_W = X1 - X0 - 36;    // second line leaves room for the time on the right
const KICKER_MAX = 120;          // longer section names are skipped
const SKIP = ["Australia news"]; // every item has this one, so it says nothing

// Font 2 glyph widths for chars 32..126, so wrapping matches the device.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

// Plain ASCII: curly quotes, dashes and the like become ASCII, accents are stripped, the rest dropped.
const MAP = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  "…": "...", " ": " ", " ": " ", " ": " ", "×": "x", "•": "*", "·": "-",
  "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "ø": "o", "Ø": "O",
  "€": "EUR", "£": "GBP", "°": " deg",
};
function ascii(s) {
  let t = String(s || "").replace(/[^\x00-\x7F]/g, (c) => (MAP[c] !== undefined ? MAP[c] : c));
  if (t.normalize) t = t.normalize("NFD");
  return t.replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

// XML text: unwrap CDATA, drop tags, decode entities.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', hellip: "..." };
function xmlText(s) {
  let t = String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "");
  for (let pass = 0; pass < 2; pass++) {
    t = t.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
    });
  }
  return ascii(t);
}
const tag = (block, name) => {
  const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? m[1] : "";
};
const tags = (block, name) => {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "gi");
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(xmlText(m[1]));
  return out;
};

// The owner's UTC offset in minutes, from now() against the real clock (rounded to 15 min).
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const p = now("YYYY MM DD HH mm").split(" ").map(Number);
const OFFSET = Math.round((Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]) - Date.now()) / 900000) * 15;
const pad = (n) => (n < 10 ? "0" : "") + n;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Fri, 20 Nov 2026 14:00:33 GMT" -> "01:00" local, or the weekday if it's more than 20 hours old.
function published(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4})?/);
  if (!m || MON[m[2].toLowerCase()] === undefined) return "";
  let off = 0;
  if (m[7]) off = (m[7][0] === "-" ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(3, 5));
  const ms = Date.UTC(+m[3], MON[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] || 0)) - off * 60000;
  const local = new Date(ms + OFFSET * 60000);
  if (Date.now() - ms > 20 * 3600000) return DAYS[local.getUTCDay()];
  return pad(local.getUTCHours()) + ":" + pad(local.getUTCMinutes());
}

// Cut s so that s + "..." fits in max px.
function ellipsis(s, max) {
  let out = s;
  while (out && width(out + "...") > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
}
// Word-wrap into a first line of w1 px and a second of w2 px; "..." if it is longer.
function wrap(title, w1, w2) {
  const words = title.split(" ");
  const lines = [""];
  for (let i = 0; i < words.length; i++) {
    const cur = lines[lines.length - 1];
    const max = lines.length === 1 ? w1 : w2;
    const next = cur ? cur + " " + words[i] : words[i];
    if (width(next) <= max) { lines[lines.length - 1] = next; continue; }
    if (lines.length === 2) return [lines[0], ellipsis(next, w2)];
    if (!cur && w1 >= 60) { lines[0] = ellipsis(words[i], w1); continue; }
    lines.push(words[i]);
  }
  if (lines.length === 2 && width(lines[1]) > w2) lines[1] = ellipsis(lines[1], w2);
  return lines;
}

let items = [];
let failed = false;
try {
  const xml = await get(FEED, { cache: 900 });
  if (typeof xml !== "string") throw new Error("not XML");
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = xmlText(tag(b, "title"));
    if (!title) continue;
    const cats = tags(b, "category").filter((c) => c && SKIP.indexOf(c) < 0 && width(c) <= KICKER_MAX);
    items.push({ title, kicker: cats[0] || "", at: published(xmlText(tag(b, "pubDate"))) });
    if (items.length === COUNT) break;
  }
} catch (e) {
  failed = true;
}

const ROW_Y = [31, 72, 113, 154, 195];
const out = {};
for (let i = 0; i < COUNT; i++) {
  const it = items[i];
  const n = "h" + (i + 1);
  let k = "", lines = [""], at = "";
  if (it) {
    k = it.kicker ? it.kicker + " /" : "";
    const kw = k ? width(k) + 5 : 0;
    lines = wrap(it.title, LINE1_W - kw, LINE2_W);
    if (!lines[0]) lines = wrap(it.title, 0, LINE2_W).slice(0, 2); // kicker took the whole line
    at = it.at;
  } else if (i === 0) {
    lines = [failed ? "Guardian feed unavailable" : "No headlines right now", "Trying again soon"];
  }
  const kw = k ? width(k) + 5 : 0;
  out[n + "_k"] = k;
  out[n + "_hx"] = X0 + (lines[0] ? kw : 0);
  out[n + "_t1"] = lines[0] || "";
  out[n + "_t2"] = lines[1] || "";
  out[n + "_at"] = at;
}

export const h1_k = out.h1_k, h1_hx = out.h1_hx, h1_t1 = out.h1_t1, h1_t2 = out.h1_t2, h1_at = out.h1_at;
export const h2_k = out.h2_k, h2_hx = out.h2_hx, h2_t1 = out.h2_t1, h2_t2 = out.h2_t2, h2_at = out.h2_at;
export const h3_k = out.h3_k, h3_hx = out.h3_hx, h3_t1 = out.h3_t1, h3_t2 = out.h3_t2, h3_at = out.h3_at;
export const h4_k = out.h4_k, h4_hx = out.h4_hx, h4_t1 = out.h4_t1, h4_t2 = out.h4_t2, h4_at = out.h4_at;
export const h5_k = out.h5_k, h5_hx = out.h5_hx, h5_t1 = out.h5_t1, h5_t2 = out.h5_t2, h5_at = out.h5_at;
export const clock = now("ddd HH:mm");
`;

const NAVY = "#052962";
const PAGE = "#FFFFFF";
const INK = "#121212";
const RED = "#C70000";
const GREY = "#707070";
const RULE = "#DCDCDC";

const wire: RawWireOp[] = [
  ["fillScreen", PAGE],
  ["fillRect", 0, 0, 320, 26, NAVY],
  ["text", "The Guardian", 8, 13, 2, 1, "ML", "#FFFFFF", ""],
  ["text", "Australia", 100, 13, 2, 1, "ML", "#C1D8FC", ""],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#FFE500", ""],
  ...[1, 2, 3, 4].map((n): RawWireOp => ["drawFastHLine", 8, ROW_Y[n] - 3, 304, RULE]),
  ...[1, 2, 3, 4, 5].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      ["text", `{h${n}_k}`, 8, y, 2, 1, "TL", RED, ""],
      ["text", `{h${n}_t1}`, `{h${n}_hx}`, y, 2, 1, "TL", INK, ""],
      ["text", `{h${n}_t2}`, 8, y + 16, 2, 1, "TL", INK, ""],
      ["text", `{h${n}_at}`, 312, y + 24, 1, 1, "MR", GREY, ""],
    ];
  }),
];

const template: Template = {
  id: "guardian-au",
  name: "Guardian Australia",
  description: "The five latest Guardian Australia headlines, each with its red section kicker and publish time, under a navy masthead.",
  apis: ["Guardian RSS"],
  category: "news",
  dataCode: code,
  rows: rows("guardian-au", wire),
  sampleVars: {"clock":"Sat 01:18","h1_at":"01:00","h1_hx":133,"h1_k":"Victorian politics /","h1_t1":"Steve Bracks is on board:","h1_t2":"Ben Carroll finds a believer as most wri...","h2_at":"01:00","h2_hx":138,"h2_k":"Australian politics /","h2_t1":"The politics of","h2_t2":"sandpapergate - Back to Back Barries p...","h3_at":"01:00","h3_hx":93,"h3_k":"Queensland /","h3_t1":"'I'm not a dangerous woman': how","h3_t2":"retirees Sandra and Marlene became the...","h4_at":"01:00","h4_hx":130,"h4_k":"New South Wales /","h4_t1":"As the Coalition stares down","h4_t2":"One Nation in NSW, a new threat is risin...","h5_at":"01:00","h5_hx":75,"h5_k":"Victoria /","h5_t1":"'It gives me power': the swimming","h5_t2":"class that's changing lives"},
};

export default template;
