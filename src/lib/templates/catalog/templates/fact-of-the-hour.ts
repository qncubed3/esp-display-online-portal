import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Fact of the hour: a random useless fact, word-wrapped as large as fits, under a "Did you know?" banner.

const factCode = String.raw`// A random useless fact from uselessfacts.jsph.pl (free, no key).
// Cached for an hour, so the fact changes hourly.
let fact = "A group of flamingos is called a flamboyance.";
let source = "";
try {
  let res = await get("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", { cache: 3600 });
  if (typeof res === "string") res = JSON.parse(res);
  if (res && res.text) {
    fact = res.text;
    source = res.source || "";
  }
} catch (e) {
  console.log("fact failed:", e.message);
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Glyph widths (px) of TFT_eSPI fonts 4 and 2 for chars 32-126, so wrapping is by real pixel width.
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s, w) => [...s].reduce((n, c) => n + (w[c.charCodeAt(0) - 32] || 0), 0);

const MAX_W = 300; // 10 px clear each side
const wrap = (text, w, maxW) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const next = line ? line + " " + word : word;
    if (line && width(next, w) > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};
const fits = (ls, w, maxW) => ls.every((l) => width(l, w) <= maxW);

// As big as fits in the body (y 48 to 216): font 4 doubled in up to 3 lines,
// font 4 in up to 6, else font 2 in up to 8 (truncated with "...").
const text = ascii(fact) || "No fact today.";
let font = 4, size = 2, pitch = 54, lines = wrap(text, W4, MAX_W / 2);
if (lines.length > 3 || !fits(lines, W4, MAX_W / 2)) {
  size = 1;
  pitch = 28;
  lines = wrap(text, W4, MAX_W);
}
if (lines.length > 6 || !fits(lines, W4, MAX_W)) {
  font = 2;
  size = 1;
  pitch = 20;
  lines = wrap(text, W2, MAX_W);
  if (lines.length > 8) {
    lines.length = 8;
    let last = lines[7];
    while (last && width(last + "...", W2) > MAX_W) last = last.slice(0, -1);
    lines[7] = last.trimEnd() + "...";
  }
}

const glyphH = (font === 4 ? 26 : 16) * size;
const top = Math.round(132 - ((lines.length - 1) * pitch + glyphH) / 2);
export const fact_font = font, fact_size = size;
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "", l4 = lines[3] || "";
export const l5 = lines[4] || "", l6 = lines[5] || "", l7 = lines[6] || "", l8 = lines[7] || "";
export const y1 = top, y2 = top + pitch, y3 = top + 2 * pitch, y4 = top + 3 * pitch;
export const y5 = top + 4 * pitch, y6 = top + 5 * pitch, y7 = top + 6 * pitch, y8 = top + 7 * pitch;
const src = ascii(source).slice(0, 22); // keeps clear of the credit on the right
export const source_line = src ? "Source: " + src : "";
export const time = now("HH:mm");
`;

const BG = "#101820";
const AMBER = "#F2B705";
const FACT = "#FFFFFF";
const MUTED = "#8090A0";

const line = (v: string, y: string): RawWireOp =>
  ["text", `{${v}}`, 160, `{${y}}`, "{fact_font}", "{fact_size}", "TC", FACT];

const factWire: RawWireOp[] = [
  ["fillScreen", BG],
  // Banner with a "!" badge.
  ["fillRect", 0, 0, 320, 40, AMBER],
  ["fillCircle", 22, 20, 14, BG],
  ["fillRoundRect", 20, 9, 5, 15, 2, AMBER],
  ["fillCircle", 22, 29, 3, AMBER],
  ["text", "DID YOU KNOW?", 46, 21, 4, 1, "ML", BG],
  ["text", "{time}", 312, 21, 2, 1, "MR", "#4A3A00"],
  // Fact, centred; unused lines are empty strings.
  line("l1", "y1"),
  line("l2", "y2"),
  line("l3", "y3"),
  line("l4", "y4"),
  line("l5", "y5"),
  line("l6", "y6"),
  line("l7", "y7"),
  line("l8", "y8"),
  // Footer.
  ["drawFastHLine", 8, 222, 304, "#2A3848"],
  ["text", "{source_line}", 8, 231, 1, 1, "ML", MUTED],
  ["text", "uselessfacts.jsph.pl", 312, 231, 1, 1, "MR", MUTED],
];

const template: Template = {
  id: "fact-of-the-hour",
  name: "Fact of the hour",
  description: "A random useless fact every hour, word-wrapped large under a \"Did you know?\" banner.",
  apis: ["Useless Facts"],
  category: "fun",
  dataCode: factCode,
  rows: rows("fact-of-the-hour", factWire),
  sampleVars: {"fact_font":4,"fact_size":1,"l1":"Julius Caesar's autograph","l2":"is worth about $2,000,000.","l3":"","l4":"","l5":"","l6":"","l7":"","l8":"","source_line":"Source: djtech.net","time":"09:00","y1":105,"y2":133,"y3":161,"y4":189,"y5":217,"y6":245,"y7":273,"y8":301},
};

export default template;
