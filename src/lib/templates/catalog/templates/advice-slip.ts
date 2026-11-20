import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Advice slip: a random piece of advice, word-wrapped and centred on a calm card.

const adviceCode = String.raw`// A random piece of advice from the Advice Slip API (free, no key).
// Cached for an hour, so the advice changes hourly.
// The API may answer as text/html, so a string reply is parsed here.
let advice = "No advice right now. Take a deep breath and try again later.";
let id = "";
try {
  let res = await get("https://api.adviceslip.com/advice", { cache: 3600 });
  if (typeof res === "string") res = JSON.parse(res);
  if (res && res.slip && res.slip.advice) {
    advice = res.slip.advice;
    id = String(res.slip.id || "");
  }
} catch (e) {
  console.log("advice failed:", e.message);
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();

// Glyph widths (px) of TFT_eSPI fonts 4 and 2 for chars 32-126, so wrapping is by real pixel width.
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s, w) => [...s].reduce((n, c) => n + (w[c.charCodeAt(0) - 32] || 0), 0);

const MAX_W = 280; // card is 304 px wide; keep 12 px clear each side
const wrap = (text, w, maxW = MAX_W) => {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
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

// As big as fits: font 4 doubled (52 px) in up to 3 lines, font 4 (26 px) in up to 6,
// else font 2 (16 px) in up to 8 lines. Every word must fit the line width too.
const text = ascii(advice);
const fits = (ls, w, maxW) => ls.every((l) => width(l, w) <= maxW);
let font = 4, size = 2, pitch = 54, lines = wrap(text, W4, MAX_W / 2);
if (lines.length > 3 || !fits(lines, W4, MAX_W / 2)) {
  size = 1;
  pitch = 28;
  lines = wrap(text, W4);
}
if (lines.length > 6 || !fits(lines, W4, MAX_W)) {
  font = 2;
  size = 1;
  pitch = 20;
  lines = wrap(text, W2);
  if (lines.length > 8) {
    lines.length = 8;
    let last = lines[7];
    while (last && width(last + "...", W2) > MAX_W) last = last.slice(0, -1);
    lines[7] = last.trimEnd() + "...";
  }
}

// Balance the lines (no lone last word): of the narrower wrap widths that keep the same
// line count, pick the one whose longest and shortest lines differ least.
if (lines.length > 1 && lines.length <= (font === 4 ? 6 : 7)) {
  const w = font === 4 ? W4 : W2;
  const spread = (ls) => {
    const ws = ls.map((l) => width(l, w));
    return Math.max(...ws) - Math.min(...ws);
  };
  let best = spread(lines);
  for (let maxW = (size === 2 ? MAX_W / 2 : MAX_W) - 4; maxW > 60; maxW -= 4) {
    const next = wrap(text, w, maxW);
    if (next.length !== lines.length || !fits(next, w, maxW)) break;
    if (spread(next) < best) {
      best = spread(next);
      lines = next;
    }
  }
}

// Centre the block in the body area (y 52 to 226).
const glyphH = (font === 4 ? 26 : 16) * size;
const top = Math.round(139 - ((lines.length - 1) * pitch + glyphH) / 2);
export const advice_font = font, advice_size = size;
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "", l4 = lines[3] || "";
export const l5 = lines[4] || "", l6 = lines[5] || "", l7 = lines[6] || "", l8 = lines[7] || "";
export const y1 = top, y2 = top + pitch, y3 = top + 2 * pitch, y4 = top + 3 * pitch;
export const y5 = top + 4 * pitch, y6 = top + 5 * pitch, y7 = top + 6 * pitch, y8 = top + 7 * pitch;
export const label = id ? "Advice #" + id : "Advice";
`;

const CARD = "#1E5A5C";
const BULB = "#FFD866";
const BASE = "#B8CCCC";

const adviceWire: RawWireOp[] = [
  ["fillScreen", "#0C2426"],
  ["fillRoundRect", 8, 8, 304, 224, 12, CARD],
  // Lightbulb: glass, highlight, neck, screw base, rays.
  ["fillCircle", 32, 24, 8, BULB],
  ["fillCircle", 29, 21, 2, "#FFF6D0"],
  ["fillRect", 29, 30, 7, 4, BULB],
  ["fillRect", 29, 35, 7, 2, BASE],
  ["fillRect", 30, 38, 5, 2, BASE],
  ["drawFastVLine", 32, 11, 3, BULB],
  ["drawLine", 22, 15, 24, 17, BULB],
  ["drawLine", 42, 15, 40, 17, BULB],
  ["drawFastHLine", 18, 24, 3, BULB],
  ["drawFastHLine", 44, 24, 3, BULB],
  ["text", "{label}", 54, 26, 2, 1, "ML", BULB],
  ["text", "adviceslip.com", 298, 26, 1, 1, "MR", "#8DB8B8"],
  ["drawFastHLine", 20, 46, 280, "#2E7477"],
  // Advice, centred; unused lines are empty strings.
  ["text", "{l1}", 160, "{y1}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l2}", 160, "{y2}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l3}", 160, "{y3}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l4}", 160, "{y4}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l5}", 160, "{y5}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l6}", 160, "{y6}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l7}", 160, "{y7}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
  ["text", "{l8}", 160, "{y8}", "{advice_font}", "{advice_size}", "TC", "#FFFFFF"],
];

const template: Template = {
  id: "advice-slip",
  name: "Advice slip",
  description: "A random piece of advice, new every hour, in big centred type.",
  apis: ["Advice Slip"],
  category: "fun",
  dataCode: adviceCode,
  rows: rows("advice-slip", adviceWire),
  sampleVars: {"advice_font": 4, "advice_size": 1, "l1": "If you're feeling tired or", "l2": "anxious, a pint of water", "l3": "will almost always", "l4": "make you feel better.", "l5": "", "l6": "", "l7": "", "l8": "", "label": "Advice #13", "y1": 84, "y2": 112, "y3": 140, "y4": 168, "y5": 196, "y6": 224, "y7": 252, "y8": 280},
};

export default template;
