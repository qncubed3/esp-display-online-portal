import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Hacker News top 5

const ROW_Y = [25, 68, 111, 154, 197]; // top of each story row (43 px each)

const hnCode = String.raw`// Top 5 Hacker News stories (official Firebase API, free, no key).
// Titles are word-wrapped to two lines of font 2 and made plain ASCII for the device fonts.
const COUNT = 5;
const ROW_Y = [25, 68, 111, 154, 197]; // top of each row in Draw
const TITLE_W = 278; // px available for a title line (x 34..312)

// Font 2 glyph widths for chars 32..126, so wrapping matches the device.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

// Plain ASCII: curly quotes, dashes and the like become ASCII, accents are stripped, the rest dropped.
const MAP = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "―": "-", "−": "-",
  "…": "...", " ": " ", " ": " ", " ": " ", "×": "x", "•": "*", "·": "-",
  "→": "->", "←": "<-", "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE",
  "ø": "o", "Ø": "O", "ł": "l", "Ł": "L", "đ": "d", "ð": "d", "þ": "th",
  "€": "EUR", "£": "GBP", "°": " deg",
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

let items = [];
let failed = false;
try {
  const ids = await get("https://hacker-news.firebaseio.com/v0/topstories.json", { cache: 300 });
  items = await Promise.all(
    ids.slice(0, COUNT).map((id) =>
      get("https://hacker-news.firebaseio.com/v0/item/" + id + ".json", { cache: 600 }).catch(() => null),
    ),
  );
} catch (e) {
  failed = true;
}

const plural = (n, one) => n + " " + one + (n === 1 ? "" : "s");
const out = {};
for (let i = 0; i < COUNT; i++) {
  const it = items[i];
  const y = ROW_Y[i];
  let lines = [""];
  let meta = "";
  if (it && it.title) {
    lines = wrap(ascii(it.title));
    meta = plural(it.score || 0, "point");
    if (typeof it.descendants === "number") meta += "   " + plural(it.descendants, "comment");
  } else if (i === 0) {
    lines = [failed ? "Hacker News is unavailable" : "Story unavailable", "Trying again soon"];
  } else if (!failed) {
    lines = ["Story unavailable"];
  }
  out["s" + (i + 1) + "_t1"] = lines[0] || "";
  out["s" + (i + 1) + "_t2"] = lines[1] || "";
  // Meta sits right under the last title line.
  out["s" + (i + 1) + "_my"] = lines.length > 1 ? y + 33 : y + 18;
  out["s" + (i + 1) + "_meta"] = meta;
  out["s" + (i + 1) + "_rank"] = failed ? "" : String(i + 1);
}

export const s1_rank = out.s1_rank, s1_t1 = out.s1_t1, s1_t2 = out.s1_t2, s1_meta = out.s1_meta, s1_my = out.s1_my;
export const s2_rank = out.s2_rank, s2_t1 = out.s2_t1, s2_t2 = out.s2_t2, s2_meta = out.s2_meta, s2_my = out.s2_my;
export const s3_rank = out.s3_rank, s3_t1 = out.s3_t1, s3_t2 = out.s3_t2, s3_meta = out.s3_meta, s3_my = out.s3_my;
export const s4_rank = out.s4_rank, s4_t1 = out.s4_t1, s4_t2 = out.s4_t2, s4_meta = out.s4_meta, s4_my = out.s4_my;
export const s5_rank = out.s5_rank, s5_t1 = out.s5_t1, s5_t2 = out.s5_t2, s5_meta = out.s5_meta, s5_my = out.s5_my;
export const clock = now("HH:mm");
`;

const BG = "#F6F6EF"; // HN's beige page background
const ORANGE = "#FF6600";

const hnWire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header bar with the "Y" logo box.
  ["fillRect", 0, 0, 320, 24, ORANGE],
  ["drawRect", 5, 4, 16, 16, "#FFFFFF"],
  ["text", "Y", 13, 12, 2, 1, "MC", "#FFFFFF", ""],
  ["text", "Hacker News", 28, 12, 2, 1, "ML", "#000000", ""],
  ["text", "Hacker News", 29, 12, 2, 1, "ML", "#000000", ""],
  ["text", "TOP 5  {clock}", 313, 12, 2, 1, "MR", "#000000", ""],
  ...[1, 2, 3, 4].map((n): RawWireOp => ["drawFastHLine", 8, ROW_Y[n] - 1, 304, "#DCDCD2"]),
  ...[1, 2, 3, 4, 5].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      ["text", `{s${n}_rank}`, 17, y + 2, 4, 1, "TC", ORANGE, ""],
      ["text", `{s${n}_t1}`, 34, y - 1, 2, 1, "TL", "#000000", ""],
      ["text", `{s${n}_t2}`, 34, y + 15, 2, 1, "TL", "#000000", ""],
      ["text", `{s${n}_meta}`, 35, `{s${n}_my}`, 1, 1, "TL", "#5E5E5E", ""],
    ];
  }),
];

const template: Template = {
  id: "hacker-news-top",
  name: "Hacker News top 5",
  description: "The five top Hacker News stories with points and comment counts under an orange HN header.",
  apis: ["Hacker News"],
  category: "tech",
  dataCode: hnCode,
  rows: rows("hacker-news-top", hnWire),
  sampleVars: {"clock": "08:45", "s1_meta": "279 points   185 comments", "s1_my": 58, "s1_rank": "1", "s1_t1": "Frostbite: A new CPU architecture", "s1_t2": "discovered, designed and verified by AI", "s2_meta": "177 points   116 comments", "s2_my": 101, "s2_rank": "2", "s2_t1": "If you can't explain something in simple", "s2_t2": "terms, you don't understand it (2017)", "s3_meta": "74 points   28 comments", "s3_my": 129, "s3_rank": "3", "s3_t1": "The Making of Oxygene", "s3_t2": "", "s4_meta": "29 points   11 comments", "s4_my": 187, "s4_rank": "4", "s4_t1": "Why the Airbus A321XLR often gets stuck", "s4_t2": "climbing for first few hours of flight", "s5_meta": "10 points   2 comments", "s5_my": 230, "s5_rank": "5", "s5_t1": "Show HN: I made an audio-to-MIDI model", "s5_t2": "60x more efficient"},
};

export default template;
