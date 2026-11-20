import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// One Hacker News front-page story at a time, large, with big points and comment counts.

const LINE_Y = [56, 83, 110, 137]; // top of each title line (font 4, 27 px pitch)
const DOT_X = [215, 225, 235, 245, 255, 265, 275, 285, 295, 305]; // rotation dots, bottom right

const code = String.raw`// One Hacker News front-page story at a time, from the Algolia HN API (free, no key, one call).
// Stories are ordered by points; the one shown is picked from the minute of the day,
// so it moves on every poll (once a minute).
const COUNT = 10; // front-page stories to rotate through (max 10)
const MAX_LINES = 4;
const LINE_W = 304; // px for a title line (x 8..312)

// Font 4 glyph widths for chars 32..126, so wrapping matches the device.
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (s) => { let w = 0; for (const ch of s) w += W4[ch.charCodeAt(0) - 32] || 0; return w; };

// Plain ASCII: curly quotes, dashes and the like become ASCII, accents are stripped, the rest dropped.
const MAP = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  "…": "...", " ": " ", " ": " ", " ": " ", "×": "x", "•": "*", "·": "-",
  "→": "->", "←": "<-", "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE",
  "ø": "o", "Ø": "O", "ł": "l", "Ł": "L", "€": "EUR", "£": "GBP", "°": " deg",
};
function ascii(s) {
  let t = String(s || "").replace(/[^\x00-\x7F]/g, (c) => (MAP[c] !== undefined ? MAP[c] : c));
  if (t.normalize) t = t.normalize("NFD");
  return t.replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

// Cut s so that s + "..." fits in max px.
function ellipsis(s, max) {
  let out = s;
  while (out && width(out + "...") > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
}
// Word-wrap to at most MAX_LINES lines; the last ends in "..." if the title is longer.
function wrap(title) {
  const words = title.split(" ");
  const lines = [""];
  for (let i = 0; i < words.length; i++) {
    const cur = lines[lines.length - 1];
    const next = cur ? cur + " " + words[i] : words[i];
    if (width(next) <= LINE_W) { lines[lines.length - 1] = next; continue; }
    if (!cur) { lines[lines.length - 1] = ellipsis(words[i], LINE_W); continue; } // one very long word
    if (lines.length === MAX_LINES) { lines[MAX_LINES - 1] = ellipsis(next, LINE_W); return lines; }
    lines.push(words[i]);
  }
  return lines;
}

function ago(sec) {
  if (!isFinite(sec)) return "";
  const min = Math.max(0, Math.floor((Date.now() / 1000 - sec) / 60));
  if (min < 60) return min + "m ago";
  const h = Math.floor(min / 60);
  if (h < 48) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}
function domain(url) {
  const m = String(url || "").match(/^https?:\/\/(?:www\.)?([^\/:?#]+)/i);
  return m ? ascii(m[1]).slice(0, 32) : "news.ycombinator.com";
}
// 1234 -> "1,234"
const num = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

let hits = [];
try {
  const res = await get("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=" + COUNT, { cache: 300 });
  hits = (res && res.hits || []).filter((h) => h && h.title);
  hits.sort((a, b) => (b.points || 0) - (a.points || 0));
} catch (e) {
  console.log("HN Algolia failed: " + e.message);
}

const n = hits.length;
const idx = n ? (+now("HH") * 60 + +now("mm")) % n : 0;
const h = hits[idx];

let lines, site, age, pts, cmts, author;
if (h) {
  lines = wrap(ascii(h.title));
  site = domain(h.url);
  age = ago(h.created_at_i);
  pts = num(h.points);
  cmts = num(h.num_comments);
  author = "by " + ascii(h.author).slice(0, 16);
} else {
  lines = ["Hacker News is", "unavailable.", "Trying again soon."];
  site = ""; age = ""; pts = "--"; cmts = "--"; author = "";
}

export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "", l4 = lines[3] || "";
export const site_name = site;
export const story_age = age;
export const points = pts;
export const comments = cmts;
export const by = author;
export const counter = n ? "#" + (idx + 1) + " OF " + n : "";
const dot = (i) => (i < n ? (i === idx ? "#FF6600" : "#3A3A3A") : "");
const dy = (i) => (i < n ? 228 : -200);
export const d1_c = dot(0), d2_c = dot(1), d3_c = dot(2), d4_c = dot(3), d5_c = dot(4);
export const d6_c = dot(5), d7_c = dot(6), d8_c = dot(7), d9_c = dot(8), d10_c = dot(9);
export const d1_y = dy(0), d2_y = dy(1), d3_y = dy(2), d4_y = dy(3), d5_y = dy(4);
export const d6_y = dy(5), d7_y = dy(6), d8_y = dy(7), d9_y = dy(8), d10_y = dy(9);
export const clock = now("HH:mm");
`;

const BG = "#111111";
const ORANGE = "#FF6600";
const GREY = "#9A9A9A";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header bar with the "Y" logo box.
  ["fillRect", 0, 0, 320, 24, ORANGE],
  ["drawRect", 6, 4, 16, 16, "#FFFFFF"],
  ["text", "Y", 14, 12, 2, 1, "MC", "#FFFFFF", ""],
  ["text", "HN Spotlight", 29, 12, 2, 1, "ML", "#000000", ""],
  ["text", "HN Spotlight", 30, 12, 2, 1, "ML", "#000000", ""],
  ["text", "{counter}   {clock}", 312, 12, 2, 1, "MR", "#000000", ""],
  // Site and age
  ["text", "{site_name}", 8, 39, 2, 1, "ML", ORANGE, ""],
  ["text", "{story_age}", 312, 39, 2, 1, "MR", GREY, ""],
  // Title, up to four lines of font 4
  ...[1, 2, 3, 4].map((i): RawWireOp => ["text", `{l${i}}`, 8, LINE_Y[i - 1], 4, 1, "TL", "#FFFFFF", ""]),
  // Stats
  ["drawFastHLine", 8, 170, 304, "#2E2E2E"],
  ["text", "{points}", 8, 178, 4, 1, "TL", ORANGE, ""],
  ["text", "POINTS", 8, 206, 1, 1, "TL", GREY, ""],
  ["text", "{comments}", 112, 178, 4, 1, "TL", "#FFFFFF", ""],
  ["text", "COMMENTS", 112, 206, 1, 1, "TL", GREY, ""],
  ["text", "{by}", 312, 191, 2, 1, "MR", GREY, ""],
  // Rotation dots
  ...DOT_X.map((x, i): RawWireOp => ["fillCircle", x, `{d${i + 1}_y}`, 3, `{d${i + 1}_c}`]),
];

const template: Template = {
  id: "hn-front-rotator",
  name: "HN story spotlight",
  description: "One Hacker News front-page story at a time in large type, with big points and comment counts, moving on every minute.",
  apis: ["HN Algolia"],
  category: "tech",
  dataCode: code,
  rows: rows("hn-front-rotator", wire),
  sampleVars: {"by":"by JacobHenner","clock":"01:22","comments":"257","counter":"#3 OF 10","d10_c":"#3A3A3A","d10_y":228,"d1_c":"#3A3A3A","d1_y":228,"d2_c":"#3A3A3A","d2_y":228,"d3_c":"#FF6600","d3_y":228,"d4_c":"#3A3A3A","d4_y":228,"d5_c":"#3A3A3A","d5_y":228,"d6_c":"#3A3A3A","d6_y":228,"d7_c":"#3A3A3A","d7_y":228,"d8_c":"#3A3A3A","d8_y":228,"d9_c":"#3A3A3A","d9_y":228,"l1":"OpenSSL: Buffer overflow","l2":"in EVP_EncodeBlock()","l3":"(CVE-2026-121481, CVSS","l4":"9.8)","points":"315","site_name":"github.com","story_age":"12h ago"},
};

export default template;
