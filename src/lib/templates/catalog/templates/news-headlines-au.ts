import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Top 5 Australian news headlines from an RSS feed (ABC News "Just In" by default).

const ROW_Y = [29, 71, 113, 155, 197]; // top of each headline row (42 px each)

const code = String.raw`// Top 5 Australian news headlines from an RSS feed, with how long ago each was published.
// Any RSS 2.0 feed works: swap FEED (and SOURCE, the name shown in the header).
const FEED = "https://www.abc.net.au/news/feed/51120/rss.xml"; // ABC News - Just In
const SOURCE = "ABC News";
const COUNT = 5;
const TITLE_W = 300; // px available for a headline line (x 12..312)

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
  for (let pass = 0; pass < 2; pass++) { // twice, for double-escaped feeds like "&amp;#39;"
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

// RFC 822 date ("Fri, 20 Nov 2026 11:58:17 +0000") to epoch ms, or NaN.
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const ZONES = { gmt: 0, ut: 0, utc: 0, z: 0, est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420 };
function parseDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[A-Za-z]+)?/);
  if (!m || MON[m[2].toLowerCase()] === undefined) { const p = Date.parse(s); return p; }
  let y = +m[3]; if (y < 100) y += 2000;
  let off = 0;
  const z = m[7] || "GMT";
  if (/^[+-]\d{4}$/.test(z)) off = (z[0] === "-" ? -1 : 1) * (+z.slice(1, 3) * 60 + +z.slice(3, 5));
  else off = ZONES[z.toLowerCase()] || 0;
  return Date.UTC(y, MON[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] || 0)) - off * 60000;
}
function ago(ms) {
  if (!isFinite(ms)) return "";
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  const h = Math.floor(min / 60);
  if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
  const d = Math.floor(h / 24);
  return d + (d === 1 ? " day ago" : " days ago");
}

// Cut s so that s + "..." fits in max px.
function ellipsis(s, max) {
  let out = s;
  while (out && width(out + "...") > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
}
// Word-wrap to at most two lines; the second line ends in "..." if the headline is longer.
function wrap(title) {
  const words = title.split(" ");
  const lines = [""];
  for (let i = 0; i < words.length; i++) {
    const cur = lines[lines.length - 1];
    const next = cur ? cur + " " + words[i] : words[i];
    if (width(next) <= TITLE_W) { lines[lines.length - 1] = next; continue; }
    if (lines.length === 2) return [lines[0], ellipsis(next, TITLE_W)];
    if (!cur) { lines[0] = ellipsis(words[i], TITLE_W); continue; } // one very long word
    lines.push(words[i]);
  }
  if (width(lines[lines.length - 1]) > TITLE_W) lines[lines.length - 1] = ellipsis(lines[lines.length - 1], TITLE_W);
  return lines;
}

let items = [];
let failed = false;
try {
  const xml = await get(FEED, { cache: 600 });
  if (typeof xml !== "string") throw new Error("not XML");
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = xmlText(tag(b, "title"));
    if (title) items.push({ title, at: ago(parseDate(xmlText(tag(b, "pubDate")))) });
    if (items.length === COUNT) break;
  }
} catch (e) {
  failed = true;
}

const ROW_Y = [29, 71, 113, 155, 197]; // top of each row in Draw
const out = {};
for (let i = 0; i < COUNT; i++) {
  const it = items[i];
  const y = ROW_Y[i];
  let lines = [""];
  let at = "";
  if (it) {
    lines = wrap(it.title);
    at = it.at;
  } else if (i === 0) {
    lines = [failed ? "News feed unavailable" : "No headlines right now", "Trying again soon"];
  }
  out["h" + (i + 1) + "_t1"] = lines[0] || "";
  out["h" + (i + 1) + "_t2"] = lines[1] || "";
  // The age sits right under the last headline line; the marker hides on empty rows.
  out["h" + (i + 1) + "_ay"] = lines.length > 1 ? y + 32 : y + 17;
  out["h" + (i + 1) + "_at"] = at;
  out["h" + (i + 1) + "_my"] = it ? y + 1 : -200;
}

export const h1_t1 = out.h1_t1, h1_t2 = out.h1_t2, h1_at = out.h1_at, h1_ay = out.h1_ay, h1_my = out.h1_my;
export const h2_t1 = out.h2_t1, h2_t2 = out.h2_t2, h2_at = out.h2_at, h2_ay = out.h2_ay, h2_my = out.h2_my;
export const h3_t1 = out.h3_t1, h3_t2 = out.h3_t2, h3_at = out.h3_at, h3_ay = out.h3_ay, h3_my = out.h3_my;
export const h4_t1 = out.h4_t1, h4_t2 = out.h4_t2, h4_at = out.h4_at, h4_ay = out.h4_ay, h4_my = out.h4_my;
export const h5_t1 = out.h5_t1, h5_t2 = out.h5_t2, h5_at = out.h5_at, h5_ay = out.h5_ay, h5_my = out.h5_my;
export const source = SOURCE;
export const clock = now("HH:mm");
`;

const BG = "#0B0E14";
const HEADER = "#1C2230";
const ACCENT = "#FFB020";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 24, HEADER],
  ["fillRect", 0, 23, 320, 1, ACCENT],
  ["text", "{source}", 8, 12, 2, 1, "ML", "#FFFFFF", ""],
  ["text", "{clock}", 312, 12, 2, 1, "MR", ACCENT, ""],
  ...[1, 2, 3, 4].map((n): RawWireOp => ["drawFastHLine", 8, ROW_Y[n] - 2, 304, "#2A3142"]),
  ...[1, 2, 3, 4, 5].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      ["fillRect", 6, `{h${n}_my}`, 2, 12, ACCENT],
      ["text", `{h${n}_t1}`, 12, y - 1, 2, 1, "TL", "#FFFFFF", ""],
      ["text", `{h${n}_t2}`, 12, y + 15, 2, 1, "TL", "#FFFFFF", ""],
      ["text", `{h${n}_at}`, 12, `{h${n}_ay}`, 1, 1, "TL", "#8A93A6", ""],
    ];
  }),
];

const template: Template = {
  id: "news-headlines-au",
  name: "Australian news headlines",
  description: "The five latest ABC News headlines, each wrapped to two lines with how long ago it was published.",
  apis: ["ABC News RSS"],
  category: "news",
  dataCode: code,
  rows: rows("news-headlines-au", wire),
  sampleVars: {"clock":"01:08","h1_at":"3 min ago","h1_ay":61,"h1_my":30,"h1_t1":"Key takeaways from UK-EU summit: Idea of","h1_t2":"Britain rejoining still on table","h2_at":"2 hours ago","h2_ay":103,"h2_my":72,"h2_t1":"Russia pummels Ukraine after Putin vowed","h2_t2":"revenge, killing eight","h3_at":"3 hours ago","h3_ay":145,"h3_my":114,"h3_t1":"Teen shot dead by police was not 'just a","h3_t2":"terrorist', mother tells inquest","h4_at":"4 hours ago","h4_ay":187,"h4_my":156,"h4_t1":"Myanmar calls international court ruling on","h4_t2":"Rohingya genocide 'unfair'","h5_at":"6 hours ago","h5_ay":229,"h5_my":198,"h5_t1":"Lions disrupt high school graduation ceremony","h5_t2":"with consecutive picks","source":"ABC News"},
};

export default template;
