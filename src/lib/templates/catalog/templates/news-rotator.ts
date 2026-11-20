import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// One big headline at a time from ABC, BBC and Guardian RSS, changing every minute.

const LINE_Y = [64, 92, 120, 148, 176]; // top of each headline line (font 4, 28 px pitch)

const code = String.raw`// One headline at a time, large, rotating through the top stories of three RSS feeds.
// The story is picked from the minute of the day, so it changes on every poll (once a minute).
// Any RSS 2.0 feed works: edit FEEDS (name, chip colours, URL).
const FEEDS = [
  { name: "ABC News", bg: "#F0F0F0", fg: "#000000", url: "https://www.abc.net.au/news/feed/51120/rss.xml" },
  { name: "BBC World", bg: "#BB1919", fg: "#FFFFFF", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Guardian AU", bg: "#1B4FA8", fg: "#FFFFFF", url: "https://www.theguardian.com/australia-news/rss" },
];
const PER_FEED = 5; // top stories taken from each feed
const MAX_LINES = 5;
const LINE_W = 300; // px for a headline line (x 10..310)

// Font 4 and font 2 glyph widths for chars 32..126, so wrapping matches the device.
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s, W) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

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
function parseDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4})?/);
  if (!m || MON[m[2].toLowerCase()] === undefined) return Date.parse(s);
  let y = +m[3]; if (y < 100) y += 2000;
  const z = m[7];
  const off = z ? (z[0] === "-" ? -1 : 1) * (+z.slice(1, 3) * 60 + +z.slice(3, 5)) : 0;
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
  while (out && width(out + "...", W4) > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
}
// Word-wrap to at most MAX_LINES lines; the last ends in "..." if the headline is longer.
function wrap(title) {
  const words = title.split(" ");
  const lines = [""];
  for (let i = 0; i < words.length; i++) {
    const cur = lines[lines.length - 1];
    const next = cur ? cur + " " + words[i] : words[i];
    if (width(next, W4) <= LINE_W) { lines[lines.length - 1] = next; continue; }
    if (!cur) { lines[lines.length - 1] = ellipsis(words[i], LINE_W); continue; } // one very long word
    if (lines.length === MAX_LINES) { lines[MAX_LINES - 1] = ellipsis(next, LINE_W); return lines; }
    lines.push(words[i]);
  }
  return lines;
}

// Fetch every feed; interleave their stories (ABC 1, BBC 1, Guardian 1, ABC 2, ...).
const lists = [];
for (const f of FEEDS) {
  const list = [];
  try {
    const xml = await get(f.url, { cache: 900 });
    if (typeof xml !== "string") throw new Error("not XML");
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const b of blocks) {
      const title = xmlText(tag(b, "title"));
      if (title) list.push({ feed: f, title, at: ago(parseDate(xmlText(tag(b, "pubDate")))) });
      if (list.length === PER_FEED) break;
    }
  } catch (e) {
    console.log(f.name + " failed: " + e.message);
  }
  lists.push(list);
}
const items = [];
for (let i = 0; i < PER_FEED; i++) for (const l of lists) if (l[i]) items.push(l[i]);

const minuteOfDay = +now("HH") * 60 + +now("mm");
const n = items.length;
const idx = n ? minuteOfDay % n : 0;
const it = items[idx];

let lines, src, srcBg, srcFg, at;
if (it) {
  lines = wrap(it.title);
  src = it.feed.name; srcBg = it.feed.bg; srcFg = it.feed.fg; at = it.at;
} else {
  lines = ["News feeds", "unavailable.", "Trying again soon."];
  src = "NEWS"; srcBg = "#3A4256"; srcFg = "#FFFFFF"; at = "";
}

export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "", l4 = lines[3] || "", l5 = lines[4] || "";
export const source = src;
export const chip_bg = srcBg;
export const chip_fg = srcFg;
export const chip_w = width(src, W2) + 14;
export const age = at;
export const counter = n ? "STORY " + (idx + 1) + " OF " + n : "";
export const bar_w = n ? Math.max(4, Math.round(((idx + 1) / n) * 200)) : 0;
export const bar_y = n ? 223 : -200;
export const clock = now("HH:mm");
`;

const BG = "#0B0E14";
const HEADER = "#1C2230";
const ACCENT = "#FFB020";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 24, HEADER],
  ["fillRect", 0, 23, 320, 1, ACCENT],
  ["text", "TOP STORIES", 8, 12, 2, 1, "ML", "#FFFFFF", ""],
  ["text", "{clock}", 312, 12, 2, 1, "MR", ACCENT, ""],
  // Source chip and age
  ["fillRoundRect", 8, 33, "{chip_w}", 20, 4, "{chip_bg}"],
  ["text", "{source}", 15, 43, 2, 1, "ML", "{chip_fg}", ""],
  ["text", "{age}", 312, 43, 2, 1, "MR", "#8A93A6", ""],
  // Headline, up to five lines of font 4
  ...[1, 2, 3, 4, 5].map((i): RawWireOp => ["text", `{l${i}}`, 10, LINE_Y[i - 1], 4, 1, "TL", "#FFFFFF", ""]),
  // Footer: position in the rotation
  ["drawFastHLine", 8, 212, 304, "#2A3142"],
  ["text", "{counter}", 8, 226, 1, 1, "ML", "#8A93A6", ""],
  ["fillRect", 112, "{bar_y}", 200, 5, "#2A3142"],
  ["fillRect", 112, "{bar_y}", "{bar_w}", 5, ACCENT],
];

const template: Template = {
  id: "news-rotator",
  name: "Rotating headline",
  description: "One large headline at a time from ABC, BBC and Guardian, moving to the next story every minute.",
  apis: ["ABC News RSS", "BBC RSS", "Guardian RSS"],
  category: "news",
  dataCode: code,
  rows: rows("news-rotator", wire),
  sampleVars: {"age":"27 min ago","bar_w":67,"bar_y":223,"chip_bg":"#BB1919","chip_fg":"#FFFFFF","chip_w":79,"clock":"01:19","counter":"STORY 5 OF 15","l1":"Russian missile hits","l2":"Poland as Ukraine's allies","l3":"hold military exercise, says","l4":"Tusk","l5":"","source":"BBC World"},
};

export default template;
