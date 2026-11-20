import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "./rows";
import type { Template } from "./types";

// Quote of the day

const quoteCode = String.raw`// Quote of the day from ZenQuotes (free, no key, changes daily; attribution required).
// The quote is word-wrapped here because Draw has no wrapping.
const MAX_CHARS = 32; // per line, font 2 (about 8 px/char)
const MAX_LINES = 6;
const PITCH = 22; // px between lines

let q = "Stay hungry, stay foolish.";
let author = "Steve Jobs";
try {
  const res = await get("https://zenquotes.io/api/today", { cache: 3600 });
  if (Array.isArray(res) && res[0] && res[0].q) {
    q = res[0].q;
    author = res[0].a || "Unknown";
  }
} catch (e) {
  console.log("quote failed:", e.message);
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");

const words = ascii(q).split(/\s+/).filter(Boolean);
const lines = [];
let line = "";
for (const w of words) {
  if (line && (line + " " + w).length > MAX_CHARS) {
    lines.push(line);
    line = w;
  } else {
    line = line ? line + " " + w : w;
  }
}
if (line) lines.push(line);
if (lines.length > MAX_LINES) {
  lines.length = MAX_LINES;
  lines[MAX_LINES - 1] = lines[MAX_LINES - 1].slice(0, MAX_CHARS - 3) + "...";
}

// Centre the block (quote + author line) between the header (y 28) and the footer (y 222).
const top = Math.round(125 - ((lines.length + 1) * PITCH + 6) / 2);
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "";
export const l4 = lines[3] || "", l5 = lines[4] || "", l6 = lines[5] || "";
export const y1 = top, y2 = top + PITCH, y3 = top + 2 * PITCH, y4 = top + 3 * PITCH, y5 = top + 4 * PITCH, y6 = top + 5 * PITCH;
export const author_line = "- " + ascii(author);
export const author_y = top + lines.length * PITCH + 6;
export const date = now("ddd DD/MM");
`;

const quoteWire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#3C1450"],
  ["setTextSize", 1],
  ["setTextDatum", "ML"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "QUOTE OF THE DAY", 8, 14, 2],
  ["setTextDatum", "MR"],
  ["setTextColor", "#D0B0E0"],
  ["drawString", "{date}", 312, 14, 2],
  ["fillRect", 8, 40, 3, 172, "#B060E0"],
  ["setTextDatum", "TC"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "{l1}", 164, "{y1}", 2],
  ["drawString", "{l2}", 164, "{y2}", 2],
  ["drawString", "{l3}", 164, "{y3}", 2],
  ["drawString", "{l4}", 164, "{y4}", 2],
  ["drawString", "{l5}", 164, "{y5}", 2],
  ["drawString", "{l6}", 164, "{y6}", 2],
  ["setTextColor", "#C080F0"],
  ["drawString", "{author_line}", 164, "{author_y}", 2],
  ["setTextColor", "#606060"],
  ["setTextDatum", "BC"],
  ["drawString", "Quotes by zenquotes.io", 160, 236, 1],
];

export const quote: Template = {
  id: "quote",
  name: "Quote of the day",
  description: "A new quote every day, word-wrapped and centred, with its author.",
  apis: ["ZenQuotes"],
  category: "fun",
  dataCode: quoteCode,
  rows: rows("quote", quoteWire),
  sampleVars: {"author_line": "- Celestine Chua", "author_y": 150, "date": "Fri 20/11", "l1": "Never waste a minute of your", "l2": "precious life thinking about", "l3": "people you don't like.", "l4": "", "l5": "", "l6": "", "y1": 78, "y2": 100, "y3": 122, "y4": 144, "y5": 166, "y6": 188},
};
