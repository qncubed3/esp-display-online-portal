import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Spaceflight headlines: one featured story in big type, three more below

const ITEM_Y = [104, 149, 194]; // top of each small item (45 px each)

const code = String.raw`// Latest spaceflight headlines from the Spaceflight News API (free, no key).
// The featured story (big type) rotates through the five latest each minute; the
// next three are listed below with a coloured source tag and how long ago they ran.
const COUNT = 5;
const CACHE = 1800; // seconds; headlines change slowly and all users share the cache
const BIG_W = 304; // px for a featured title line, font 4
const SMALL_W = 300; // px for a small title line, font 2 (x 14..314)
const ITEM_Y = [104, 149, 194]; // top of each small item in Draw
const HIDE = -200;

// Glyph widths (chars 32-126) for font 2 and font 4, to wrap by pixels.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (W) => (s) => [...s].reduce((n, ch) => n + (W[ch.charCodeAt(0) - 32] || 8), 0);
const w2 = width(W2);
const w4 = width(W4);

// Fonts are ASCII only: drop accents, straighten quotes and dashes, remove the rest.
function ascii(s) {
  let t = String(s || "");
  try { t = t.normalize("NFD"); } catch (e) {}
  return t
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();
}

// Cut s so that s + "..." fits in px.
function ellipsis(s, px, w) {
  while (s.length && w(s + "...") > px) s = s.slice(0, -1);
  return s.replace(/[\s,;:.-]+$/, "") + "...";
}

// Word-wrap to at most two lines; the second ends in "..." if the title is longer.
function wrap2(s, px, w) {
  const lines = [""];
  for (const word of s.split(" ").filter(Boolean)) {
    const cur = lines[lines.length - 1];
    const next = cur ? cur + " " + word : word;
    if (w(next) <= px) { lines[lines.length - 1] = next; continue; }
    if (lines.length === 2) return [lines[0], ellipsis(next, px, w)];
    if (!cur) { lines[0] = ellipsis(word, px, w); continue; }
    lines.push(word);
  }
  const last = lines.length - 1;
  if (w(lines[last]) > px) lines[last] = ellipsis(lines[last], px, w);
  return lines;
}

// "12m ago", "3h ago", "2d ago" from an ISO timestamp.
function ago(iso) {
  const t = Date.parse(iso || "");
  if (!isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return m + "m ago";
  if (m < 48 * 60) return Math.round(m / 60) + "h ago";
  return Math.round(m / 1440) + "d ago";
}

// A stable colour per news site, so the same source always gets the same tag.
const TAGS = ["#3D8BF0", "#F06A2C", "#33A852", "#B45AD6", "#E0457E", "#1FA5BA", "#C99A1A", "#7F6BF0"];
function tagColor(site) {
  let h = 0;
  for (const ch of site) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return TAGS[h % TAGS.length];
}
// Tag text: upper case, short enough for its pill.
function tagText(site, maxChars) {
  const t = site.toUpperCase();
  return t.length > maxChars ? t.slice(0, maxChars - 1).trimEnd() + "." : t;
}

let items = [];
try {
  const res = await get("https://api.spaceflightnewsapi.net/v4/articles/?limit=" + COUNT, { cache: CACHE });
  items = (res && res.results ? res.results : []).filter((a) => a && a.title).slice(0, COUNT);
} catch (e) {
  console.log("Spaceflight News failed:", e.message);
}

// Featured story rotates each minute; the others follow in order.
const start = items.length ? Number(now("mm")) % items.length : 0;
const order = items.map((_, i) => items[(start + i) % items.length]);

const out = {};
const f = order[0];
if (f) {
  const site = ascii(f.news_site) || "News";
  const tag = tagText(site, 24);
  const fl = wrap2(ascii(f.title), BIG_W, w4);
  out.f_tag = tag;
  out.f_tag_w = tag.length * 6 + 8;
  out.f_tag_c = tagColor(site);
  out.f_tag_x = 8;
  out.f_ago = ago(f.published_at);
  out.f_ago_x = 8 + tag.length * 6 + 8 + 6;
  out.f_t1 = fl[0] || "";
  out.f_t2 = fl[1] || "";
} else {
  out.f_tag = "";
  out.f_tag_w = 0;
  out.f_tag_c = "#2E7DD7";
  out.f_tag_x = HIDE;
  out.f_ago = "";
  out.f_ago_x = 8;
  out.f_t1 = "No headlines";
  out.f_t2 = "Spaceflight News is unavailable";
}
for (let i = 0; i < 3; i++) {
  const n = i + 1;
  const a = order[i + 1];
  if (a) {
    const site = ascii(a.news_site) || "News";
    const tl = wrap2(ascii(a.title), SMALL_W, w2);
    out["i" + n + "_tag"] = tagText(site, 30) + "  " + ago(a.published_at);
    out["i" + n + "_c"] = tagColor(site);
    out["i" + n + "_bar_y"] = ITEM_Y[i];
    out["i" + n + "_bar_h"] = tl.length > 1 ? 42 : 26;
    out["i" + n + "_t1"] = tl[0] || "";
    out["i" + n + "_t2"] = tl[1] || "";
  } else {
    out["i" + n + "_tag"] = "";
    out["i" + n + "_c"] = "#2E7DD7";
    out["i" + n + "_bar_y"] = HIDE;
    out["i" + n + "_bar_h"] = 0;
    out["i" + n + "_t1"] = "";
    out["i" + n + "_t2"] = "";
  }
}

export const f_tag = out.f_tag, f_tag_w = out.f_tag_w, f_tag_c = out.f_tag_c, f_tag_x = out.f_tag_x;
export const f_ago = out.f_ago, f_ago_x = out.f_ago_x, f_t1 = out.f_t1, f_t2 = out.f_t2;
export const i1_tag = out.i1_tag, i1_c = out.i1_c, i1_bar_y = out.i1_bar_y, i1_bar_h = out.i1_bar_h, i1_t1 = out.i1_t1, i1_t2 = out.i1_t2;
export const i2_tag = out.i2_tag, i2_c = out.i2_c, i2_bar_y = out.i2_bar_y, i2_bar_h = out.i2_bar_h, i2_t1 = out.i2_t1, i2_t2 = out.i2_t2;
export const i3_tag = out.i3_tag, i3_c = out.i3_c, i3_bar_y = out.i3_bar_y, i3_bar_h = out.i3_bar_h, i3_t1 = out.i3_t1, i3_t2 = out.i3_t2;
export const clock = now("HH:mm");
`;

const BG = "#05070F";
const ACCENT = "#7FB2FF";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 24, "#121C38"],
  ["fillCircle", 14, 12, 4, ACCENT],
  ["drawCircle", 14, 12, 7, "#3E5A96"],
  ["text", "SPACEFLIGHT NEWS", 28, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 12, 2, 1, "MR", ACCENT],
  // Featured story
  ["fillRoundRect", "{f_tag_x}", 30, "{f_tag_w}", 13, 3, "{f_tag_c}"],
  ["text", "{f_tag}", 12, 37, 1, 1, "ML", "#FFFFFF"],
  ["text", "{f_ago}", "{f_ago_x}", 37, 1, 1, "ML", "#9AA3B8"],
  ["text", "{f_t1}", 8, 46, 4, 1, "TL", "#FFFFFF"],
  ["text", "{f_t2}", 8, 72, 4, 1, "TL", "#FFFFFF"],
  ["drawFastHLine", 8, 100, 304, "#26324F"],
  // Three more headlines
  ...[1, 2, 3].flatMap((n): RawWireOp[] => {
    const y = ITEM_Y[n - 1];
    return [
      ["fillRect", 8, `{i${n}_bar_y}`, 3, `{i${n}_bar_h}`, `{i${n}_c}`],
      ["text", `{i${n}_tag}`, 14, y, 1, 1, "TL", `{i${n}_c}`],
      ["text", `{i${n}_t1}`, 14, y + 9, 2, 1, "TL", "#D8DCE8"],
      ["text", `{i${n}_t2}`, 14, y + 25, 2, 1, "TL", "#D8DCE8"],
    ];
  }),
];

const template: Template = {
  id: "space-news",
  name: "Spaceflight headlines",
  description:
    "The latest spaceflight news: a featured headline in big type that rotates each minute, plus three more with a coloured source tag and how long ago they ran.",
  apis: ["Spaceflight News"],
  category: "news",
  dataCode: code,
  rows: rows("space-news", wire),
  sampleVars: {"clock":"01:13","f_ago":"14h ago","f_ago_x":112,"f_t1":"Live coverage: SpaceX to","f_t2":"launch classified payloa...","f_tag":"SPACEFLIGHT NOW","f_tag_c":"#33A852","f_tag_w":98,"f_tag_x":8,"i1_bar_h":42,"i1_bar_y":104,"i1_c":"#F06A2C","i1_t1":"Relativity tests Terran R second stage,","i1_t2":"completes structural qualifications ahead of...","i1_tag":"NASASPACEFLIGHT  16h ago","i2_bar_h":42,"i2_bar_y":149,"i2_c":"#C99A1A","i2_t1":"Danish Soldiers Are Sneaking Starlink Terminals","i2_t2":"into Greenland","i2_tag":"EUROPEAN SPACEFLIGHT  7h ago","i3_bar_h":26,"i3_bar_y":194,"i3_c":"#C99A1A","i3_t1":"APOD: 2026 November 20 - V-G-R","i3_t2":"","i3_tag":"NASA  9h ago"},
};

export default template;
