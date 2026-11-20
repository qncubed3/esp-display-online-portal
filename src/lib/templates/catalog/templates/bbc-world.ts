import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// BBC World headlines: the top story with its summary, then three more headlines.

const ITEM_Y = [120, 160, 200]; // top of each smaller headline (40 px each)

const code = String.raw`// BBC News World headlines from the public RSS feed (no key).
// The top story shows its title and one-paragraph summary; the next three list titles only.
const FEED = "https://feeds.bbci.co.uk/news/world/rss.xml";
const CACHE = 900; // seconds; the feed's own ttl is 15 minutes
const TITLE_W = 304; // px for a top-story line (x 8..312)
const ITEM_W = 296; // px for a smaller headline line (x 16..312)
const ITEM_Y = [120, 160, 200]; // top of each smaller headline in Draw
const HIDE = -200;

// Font 2 glyph widths for chars 32..126, so wrapping matches the device.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

// Plain ASCII: curly quotes and dashes become ASCII, accents are stripped, the rest dropped.
const MAP = {
  "‘": "'", "’": "'", "‚": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  "…": "...", " ": " ", "×": "x", "•": "*", "·": "-",
  "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "ø": "o", "Ø": "O",
  "€": "EUR", "£": "GBP", "°": " deg",
};
function ascii(s) {
  let t = String(s || "").replace(/[^\x00-\x7F]/g, (c) => (MAP[c] !== undefined ? MAP[c] : c));
  try { t = t.normalize("NFD"); } catch (e) {}
  return t.replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

// XML text: unwrap CDATA, drop tags, decode entities.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', hellip: "..." };
function xmlText(s) {
  let t = String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "");
  for (let pass = 0; pass < 2; pass++) { // twice, for double-escaped text like "&amp;#39;"
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

// "Fri, 20 Nov 2026 13:01:16 GMT" -> "2 hours ago".
function ago(s) {
  const ms = Date.parse(s);
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
// Word-wrap to at most two lines; the second ends in "..." if the text is longer.
function wrap2(text, max) {
  const lines = [""];
  for (const word of text.split(" ").filter(Boolean)) {
    const cur = lines[lines.length - 1];
    const next = cur ? cur + " " + word : word;
    if (width(next) <= max) { lines[lines.length - 1] = next; continue; }
    if (lines.length === 2) return [lines[0], ellipsis(next, max)];
    if (!cur) { lines[0] = ellipsis(word, max); continue; }
    lines.push(word);
  }
  const last = lines.length - 1;
  if (width(lines[last]) > max) lines[last] = ellipsis(lines[last], max);
  return lines;
}

let items = [];
let failed = false;
try {
  const xml = await get(FEED, { cache: CACHE });
  if (typeof xml !== "string") throw new Error("not XML");
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = xmlText(tag(b, "title"));
    if (title) items.push({ title, desc: xmlText(tag(b, "description")), at: ago(xmlText(tag(b, "pubDate"))) });
    if (items.length === 4) break;
  }
} catch (e) {
  failed = true;
}

// Top story: label and age, title (1-2 lines), then the summary (up to 2 lines) right under it.
const top = items[0];
const tTitle = top ? wrap2(top.title, TITLE_W) : [failed ? "BBC feed unavailable" : "No headlines right now"];
const tDesc = top ? (top.desc ? wrap2(top.desc, TITLE_W) : []) : ["Trying again soon"];
const descY = 43 + 16 * tTitle.length + 2;

export const top_t1 = tTitle[0] || "", top_t2 = tTitle[1] || "";
export const top_d1 = tDesc[0] || "", top_d2 = tDesc[1] || "";
export const top_dy1 = descY, top_dy2 = descY + 16;
export const top_at = top ? top.at : "";
export const top_label = top ? "TOP STORY" : "";

// Three more headlines; the red marker hides on empty rows.
const out = {};
for (let i = 0; i < 3; i++) {
  const it = items[i + 1];
  const lines = it ? wrap2(it.title, ITEM_W) : [""];
  out["i" + (i + 1) + "_t1"] = lines[0] || "";
  out["i" + (i + 1) + "_t2"] = lines[1] || "";
  out["i" + (i + 1) + "_my"] = it ? ITEM_Y[i] + 2 : HIDE;
}
export const i1_t1 = out.i1_t1, i1_t2 = out.i1_t2, i1_my = out.i1_my;
export const i2_t1 = out.i2_t1, i2_t2 = out.i2_t2, i2_my = out.i2_my;
export const i3_t1 = out.i3_t1, i3_t2 = out.i3_t2, i3_my = out.i3_my;
export const div_y = items.length > 1 ? 113 : HIDE;
export const clock = now("HH:mm");
`;

const BG = "#0A0A0A";
const RED = "#B80000";
const MUTED = "#8C919B";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 26, RED],
  ["text", "BBC World", 8, 13, 2, 1, "ML", "#FFFFFF", ""],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#FFFFFF", ""],
  // Top story
  ["text", "{top_label}", 8, 32, 1, 1, "TL", "#FF5A5A", ""],
  ["text", "{top_at}", 312, 32, 1, 1, "TR", MUTED, ""],
  ["text", "{top_t1}", 8, 43, 2, 1, "TL", "#FFFFFF", ""],
  ["text", "{top_t2}", 8, 59, 2, 1, "TL", "#FFFFFF", ""],
  ["text", "{top_d1}", 8, "{top_dy1}", 2, 1, "TL", "#A9AEB8", ""],
  ["text", "{top_d2}", 8, "{top_dy2}", 2, 1, "TL", "#A9AEB8", ""],
  ["drawFastHLine", 8, "{div_y}", 304, "#3A3A3A"],
  // More headlines
  ...[1, 2, 3].flatMap((n): RawWireOp[] => {
    const y = ITEM_Y[n - 1];
    return [
      ["fillRect", 8, `{i${n}_my}`, 3, 12, RED],
      ["text", `{i${n}_t1}`, 16, y, 2, 1, "TL", "#E2E4E8", ""],
      ["text", `{i${n}_t2}`, 16, y + 16, 2, 1, "TL", "#E2E4E8", ""],
    ];
  }),
];

const template: Template = {
  id: "bbc-world",
  name: "BBC World headlines",
  description: "The top BBC World story with its summary, plus the next three headlines.",
  apis: ["BBC News RSS"],
  category: "news",
  dataCode: code,
  rows: rows("bbc-world", wire),
  sampleVars: {"clock":"01:18","div_y":113,"i1_my":122,"i1_t1":"Russian missile hits Poland as Ukraine's allies","i1_t2":"hold military exercise, says Tusk","i2_my":162,"i2_t1":"Nearly 600 women killed in South Africa within","i2_t2":"three months","i3_my":202,"i3_t1":"White House removes cyber-security chief","i3_t2":"after series of tech outages","top_at":"1 hour ago","top_d1":"Russia launched one of its biggest air attacks","top_d2":"yet as it rejected the prospect of security gu...","top_dy1":77,"top_dy2":93,"top_label":"TOP STORY","top_t1":"Russia targets Kyiv crossings days after Ukraine","top_t2":"hits Crimean Bridge"},
};

export default template;
