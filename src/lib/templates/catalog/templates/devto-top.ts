import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// DEV Community top posts of the day

const ROW_Y = [26, 68, 110, 152, 194]; // top of each post row (42 px each)
const HEART_X = 280; // centre of the heart icon in the meta line

const code = String.raw`// Top 5 posts on DEV (dev.to) over the last day, from the public Forem API (free, no key).
// Titles are word-wrapped to two lines of font 2 and made plain ASCII for the device fonts.
const DAYS = 1; // "top" window in days: 1 = today, 7 = this week
const COUNT = 5;
const CACHE = 1800; // seconds; top posts change slowly and all users share the cache
const ROW_Y = [26, 68, 110, 152, 194]; // top of each row in Draw
const TITLE_W = 278; // px for a title line (x 34..312)
const AUTHOR_CHARS = 38; // font 1 is 6 px per char; the heart count sits at the right
const HIDE = -200;

// Font 2 glyph widths for chars 32..126, so wrapping matches the device.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

// Fonts are ASCII only: drop accents, straighten quotes and dashes, remove emoji and the rest.
function ascii(s) {
  let t = String(s || "");
  try { t = t.normalize("NFD"); } catch (e) {}
  return t
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Cut s so that s + "..." fits in max px.
function ellipsis(s, max) {
  let out = s;
  while (out && width(out + "...") > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
}

// Word-wrap to at most two lines; the second line ends in "..." if the title is longer.
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

let posts = [];
let failed = false;
try {
  const res = await get("https://dev.to/api/articles?top=" + DAYS + "&per_page=" + COUNT, { cache: CACHE });
  if (Array.isArray(res)) posts = res; else failed = true;
} catch (e) {
  failed = true;
}

const out = {};
for (let i = 0; i < COUNT; i++) {
  const p = posts[i];
  const y = ROW_Y[i];
  let lines = [""];
  let meta = "";
  let likes = "";
  let hc = HIDE, ht = HIDE, hb = HIDE;
  if (p && p.title) {
    lines = wrap(ascii(p.title));
    const author = ascii(p.user && p.user.name) || "DEV";
    const mins = p.reading_time_minutes ? p.reading_time_minutes + " min read" : "";
    meta = mins ? author.slice(0, AUTHOR_CHARS - mins.length - 3) + " - " + mins : author.slice(0, AUTHOR_CHARS);
    likes = String(p.positive_reactions_count || 0);
  } else if (i === 0) {
    lines = [failed ? "DEV is unavailable" : "No top posts yet today", "Trying again soon"];
  }
  // Meta sits right under the last title line.
  const my = lines.length > 1 && lines[1] ? y + 33 : y + 18;
  if (likes) { hc = my + 2; ht = my + 3; hb = my + 7; }
  out["p" + (i + 1) + "_t1"] = lines[0] || "";
  out["p" + (i + 1) + "_t2"] = lines[1] || "";
  out["p" + (i + 1) + "_my"] = my;
  out["p" + (i + 1) + "_meta"] = meta;
  out["p" + (i + 1) + "_likes"] = likes;
  out["p" + (i + 1) + "_hc"] = hc;
  out["p" + (i + 1) + "_ht"] = ht;
  out["p" + (i + 1) + "_hb"] = hb;
  out["p" + (i + 1) + "_rank"] = p && p.title ? String(i + 1) : "";
}

export const p1_rank = out.p1_rank, p1_t1 = out.p1_t1, p1_t2 = out.p1_t2, p1_meta = out.p1_meta, p1_my = out.p1_my, p1_likes = out.p1_likes, p1_hc = out.p1_hc, p1_ht = out.p1_ht, p1_hb = out.p1_hb;
export const p2_rank = out.p2_rank, p2_t1 = out.p2_t1, p2_t2 = out.p2_t2, p2_meta = out.p2_meta, p2_my = out.p2_my, p2_likes = out.p2_likes, p2_hc = out.p2_hc, p2_ht = out.p2_ht, p2_hb = out.p2_hb;
export const p3_rank = out.p3_rank, p3_t1 = out.p3_t1, p3_t2 = out.p3_t2, p3_meta = out.p3_meta, p3_my = out.p3_my, p3_likes = out.p3_likes, p3_hc = out.p3_hc, p3_ht = out.p3_ht, p3_hb = out.p3_hb;
export const p4_rank = out.p4_rank, p4_t1 = out.p4_t1, p4_t2 = out.p4_t2, p4_meta = out.p4_meta, p4_my = out.p4_my, p4_likes = out.p4_likes, p4_hc = out.p4_hc, p4_ht = out.p4_ht, p4_hb = out.p4_hb;
export const p5_rank = out.p5_rank, p5_t1 = out.p5_t1, p5_t2 = out.p5_t2, p5_meta = out.p5_meta, p5_my = out.p5_my, p5_likes = out.p5_likes, p5_hc = out.p5_hc, p5_ht = out.p5_ht, p5_hb = out.p5_hb;
export const label = DAYS === 1 ? "TODAY" : DAYS === 7 ? "THIS WEEK" : DAYS + " DAYS";
export const clock = now("HH:mm");
`;

const BG = "#F5F5F5"; // DEV's light page grey
const INK = "#171717";
const INDIGO = "#3B49DF"; // DEV's link and button colour
const HEART = "#DC1818";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // White header bar with the black DEV logo box.
  ["fillRect", 0, 0, 320, 25, "#FFFFFF"],
  ["drawFastHLine", 0, 25, 320, "#D4D4D4"],
  ["fillRoundRect", 6, 3, 36, 19, 3, "#000000"],
  ["text", "DEV", 24, 13, 2, 1, "MC", "#FFFFFF", ""],
  ["text", "DEV", 25, 13, 2, 1, "MC", "#FFFFFF", ""],
  ["text", "Top posts", 50, 13, 2, 1, "ML", INK, ""],
  ["text", "{label}  {clock}", 313, 13, 2, 1, "MR", "#575757", ""],
  ...[1, 2, 3, 4].map((n): RawWireOp => ["drawFastHLine", 8, ROW_Y[n] - 1, 304, "#E0E0E0"]),
  ...[1, 2, 3, 4, 5].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    const hc = `{p${n}_hc}`;
    return [
      ["text", `{p${n}_rank}`, 17, y + 2, 4, 1, "TC", INDIGO, ""],
      ["text", `{p${n}_t1}`, 34, y - 1, 2, 1, "TL", INK, ""],
      ["text", `{p${n}_t2}`, 34, y + 15, 2, 1, "TL", INK, ""],
      ["text", `{p${n}_meta}`, 35, `{p${n}_my}`, 1, 1, "TL", "#5E5E5E", ""],
      // Small heart: two circles and a triangle, hidden off-screen when there is no post.
      ["fillCircle", HEART_X - 2, hc, 2, HEART],
      ["fillCircle", HEART_X + 2, hc, 2, HEART],
      ["fillTriangle", HEART_X - 4, `{p${n}_ht}`, HEART_X + 4, `{p${n}_ht}`, HEART_X, `{p${n}_hb}`, HEART],
      ["text", `{p${n}_likes}`, 312, `{p${n}_my}`, 1, 1, "TR", "#3D3D3D", ""],
    ];
  }),
];

const template: Template = {
  id: "devto-top",
  name: "DEV top posts",
  description: "Today's five top posts on DEV (dev.to) with author, reading time and reaction count.",
  apis: ["DEV.to"],
  category: "tech",
  dataCode: code,
  rows: rows("devto-top", wire),
  sampleVars: {"clock": "08:45", "label": "TODAY", "p1_hb": 51, "p1_hc": 46, "p1_ht": 47, "p1_likes": "38", "p1_meta": "Peter Kim Frank - 4 min read", "p1_my": 44, "p1_rank": "1", "p1_t1": "What team-wide AI adoption actually takes", "p1_t2": "", "p2_hb": 108, "p2_hc": 103, "p2_ht": 104, "p2_likes": "10", "p2_meta": "Lauren Lee - 1 min read", "p2_my": 101, "p2_rank": "2", "p2_t1": "I can't believe the podcast I learned to", "p2_t2": "code with is back!", "p3_hb": 150, "p3_hc": 145, "p3_ht": 146, "p3_likes": "18", "p3_meta": "Jean-Phi Baconnais - 3 min read", "p3_my": 143, "p3_rank": "3", "p3_t1": "Maintaining open source projects up to", "p3_t2": "date with Renovate and Antigravity", "p4_hb": 192, "p4_hc": 187, "p4_ht": 188, "p4_likes": "14", "p4_meta": "Nnamdi Felix Ibe - 7 min read", "p4_my": 185, "p4_rank": "4", "p4_t1": "Day 87: A Redirected Module and a Renamed", "p4_t2": "Publisher", "p5_hb": 234, "p5_hc": 229, "p5_ht": 230, "p5_likes": "33", "p5_meta": "Self-Correcting Systems - 21 min read", "p5_my": 227, "p5_rank": "5", "p5_t1": "Everybody Has an AI Apocalypse Story.", "p5_t2": "Almost Nobody Reads the Fine Print."},
};

export default template;
