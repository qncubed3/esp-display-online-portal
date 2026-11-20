import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// A one-liner dad joke from icanhazdadjoke (keyless), centred and word-wrapped.
// Short jokes use the big font 4; long ones shrink to font 2 so they still fit.
// The /slack path always returns JSON (the root URL returns HTML for this client).
const TEXT_W = 296; // px of text per line
const TOP = 34; // text area, below the header
const BOTTOM = 192; // text area ends above the smiley

let joke = "I'm reading a book about anti-gravity. It's impossible to put down.";
try {
  const j = await get("https://icanhazdadjoke.com/slack", { cache: 600 });
  const t = j && j.attachments && j.attachments[0] && j.attachments[0].text;
  if (t) joke = t;
} catch (e) {
  console.log("icanhazdadjoke failed:", e.message);
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else, flatten newlines.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Glyph widths for char codes 32..127.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15,1];
const width = (s, W) => {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += W[s.charCodeAt(i) - 32] || 8;
  return w;
};

// Word-wrap by pixel width; cut over-long words; ellipsis if it runs past maxLines.
const wrap = (text, W, maxLines) => {
  const out = [];
  let line = "";
  for (let w of text.split(" ").filter(Boolean)) {
    while (width(w, W) > TEXT_W) {
      let k = w.length;
      while (k > 1 && width(w.slice(0, k), W) > TEXT_W) k--;
      if (line) { out.push(line); line = ""; }
      out.push(w.slice(0, k));
      w = w.slice(k);
    }
    const t = line ? line + " " + w : w;
    if (line && width(t, W) > TEXT_W) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  const fits = out.length <= maxLines;
  if (!fits) {
    out.length = maxLines;
    let last = out[maxLines - 1];
    while (last && width(last + "...", W) > TEXT_W) last = last.slice(0, -1);
    out[maxLines - 1] = last.trimEnd() + "...";
  }
  return { lines: out.length ? out : ["..."], fits };
};

const text = ascii(joke);
let fnt = 4, pitch = 28;
let r = wrap(text, W4, 5);
if (!r.fits) {
  fnt = 2; pitch = 19;
  r = wrap(text, W2, 8);
}
const L = r.lines;

// Centre the block vertically in the text area; each line is drawn with a TC datum.
const lineH = fnt === 4 ? 26 : 16;
const blockH = (L.length - 1) * pitch + lineH;
const y0 = Math.round(TOP + (BOTTOM - TOP - blockH) / 2);

export const font = fnt;
export const l1 = L[0] || "", l2 = L[1] || "", l3 = L[2] || "", l4 = L[3] || "";
export const l5 = L[4] || "", l6 = L[5] || "", l7 = L[6] || "", l8 = L[7] || "";
export const y1 = y0, y2 = y0 + pitch, y3 = y0 + 2 * pitch, y4 = y0 + 3 * pitch;
export const y5 = y0 + 4 * pitch, y6 = y0 + 5 * pitch, y7 = y0 + 6 * pitch, y8 = y0 + 7 * pitch;
export const time = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#14110A"],
  ["fillRect", 0, 0, 320, 26, "#3A2C08"],
  ["text", "DAD JOKE", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{time}", 312, 13, 2, 1, "MR", "#FFD45A"],
  // The joke, centred.
  ["text", "{l1}", 160, "{y1}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l2}", 160, "{y2}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l3}", 160, "{y3}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l4}", 160, "{y4}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l5}", 160, "{y5}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l6}", 160, "{y6}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l7}", 160, "{y7}", "{font}", 1, "TC", "#FFFFFF"],
  ["text", "{l8}", 160, "{y8}", "{font}", 1, "TC", "#FFFFFF"],
  // Footer rule, credit and smiley.
  ["drawFastHLine", 8, 200, 260, "#3A2C08"],
  ["text", "icanhazdadjoke.com", 8, 222, 1, 1, "ML", "#7A6A48"],
  ["fillCircle", 292, 214, 18, "#FFC83A"],
  ["fillCircle", 292, 216, 11, "#14110A"],
  ["fillCircle", 292, 211, 12, "#FFC83A"],
  ["fillCircle", 286, 207, 2, "#14110A"],
  ["fillCircle", 298, 207, 2, "#14110A"],
];

const template: Template = {
  id: "dad-joke",
  name: "Dad joke",
  description: "A one-liner dad joke, centred and auto-sized, with a grinning smiley.",
  apis: ["icanhazdadjoke"],
  category: "fun",
  dataCode: code,
  rows: rows("dad-joke", wire),
  sampleVars: {"font":4,"l1":"Pie is $2.50 in Jamaica","l2":"and $3.00 in The","l3":"Bahamas. These are the","l4":"pie-rates of the","l5":"Caribbean.","l6":"","l7":"","l8":"","time":"01:23","y1":44,"y2":72,"y3":100,"y4":128,"y5":156,"y6":184,"y7":212,"y8":240},
};

export default template;
