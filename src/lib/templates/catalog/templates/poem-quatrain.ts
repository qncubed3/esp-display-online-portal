import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// A four-line poem for today from PoetryDB (free, no key).
// One request returns every 4-line poem (about 20 KB); the day of the year picks one.
const MAX_W = 288; // px per row in font 2
const MAX_ROWS = 8; // poem rows that fit between the header and the title
const PITCH = 18; // px between rows
const BODY_TOP = 32, BODY_BOTTOM = 190; // body area, between the rules

// Font 2 widths (chars 32-126), so wrapping is measured in pixels, not characters.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const width = (s) => { let n = 0; for (let i = 0; i < s.length; i++) n += W[s.charCodeAt(i) - 32] || 8; return n; };

// Fonts are ASCII only: straighten quotes and dashes, strip accents, drop anything else.
const ascii = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Word-wrap one line of verse into rows no wider than MAX_W.
const wrap = (text) => {
  const out = [];
  let row = "";
  for (const w of text.split(" ")) {
    const next = row ? row + " " + w : w;
    if (row && width(next) > MAX_W) { out.push(row); row = w; } else row = next;
  }
  if (row) out.push(row);
  return out;
};

// Cut a string to fit a pixel width, adding "..." if it was cut.
const fit = (s, max) => {
  if (width(s) <= max) return s;
  while (s.length && width(s + "...") > max) s = s.slice(0, -1);
  return s.trimEnd() + "...";
};

let body = ["No poem today.", "", "The poetry server", "did not answer."];
let title = "--";
let author = "";
// PoetryDB is sometimes slow (1-5 s), so try twice before giving up.
let res = null;
for (let attempt = 0; attempt < 2 && !res; attempt++) {
  try {
    res = await get("https://poetrydb.org/linecount/4/title,author,lines", { cache: 86400 });
  } catch (e) {
    console.log("poetrydb failed:", e.message);
  }
}
if (Array.isArray(res)) {
  {
    // Prefer poems whose lines each fit on one row; wrap only if none do.
    const whole = [], wrappedFits = [];
    for (const p of res) {
      if (!p || !Array.isArray(p.lines)) continue;
      const verse = p.lines.map(ascii).filter(Boolean);
      if (verse.length === 0) continue;
      const wrapped = [];
      for (const l of verse) for (const r of wrap(l)) wrapped.push(r);
      const item = { rows: wrapped, title: ascii(p.title), author: ascii(p.author) };
      if (wrapped.length === verse.length && verse.length <= 5) whole.push(item);
      else if (wrapped.length <= MAX_ROWS) wrappedFits.push(item);
    }
    const fits = whole.length ? whole : wrappedFits;
    if (fits.length) {
      const y = +now("YYYY"), m = +now("MM"), d = +now("DD");
      const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
      const pick = fits[(doy + y * 7) % fits.length];
      body = pick.rows;
      title = pick.title || "Untitled";
      author = pick.author;
    }
  }
}

// Centre the poem vertically in the body area; space short poems more loosely.
const pitch = body.length <= 5 ? 26 : PITCH;
const top = Math.round((BODY_TOP + BODY_BOTTOM) / 2 - ((body.length - 1) * pitch + 16) / 2);
const row = (i) => body[i] || "";
const rowY = (i) => (i < body.length ? top + i * pitch : -200);
export const r1 = row(0), r2 = row(1), r3 = row(2), r4 = row(3);
export const r5 = row(4), r6 = row(5), r7 = row(6), r8 = row(7);
export const y1 = rowY(0), y2 = rowY(1), y3 = rowY(2), y4 = rowY(3);
export const y5 = rowY(4), y6 = rowY(5), y7 = rowY(6), y8 = rowY(7);
export const poem_title = fit(title, 290);
export const poem_author = author ? fit(author.toUpperCase(), 290) : "";
export const date = now("ddd DD/MM");
`;

const INK = "#3A2A1C";
const ACCENT = "#8A2E1E";
const MUTED = "#8A7A66";
const PAPER = "#F4ECD8";

const wire: RawWireOp[] = [
  ["fillScreen", PAPER],
  // Double hairline border for a printed-page feel.
  ["drawRect", 3, 3, 314, 234, ACCENT],
  ["drawRect", 6, 6, 308, 228, "#C8B898"],
  // Header: small caps label and the date.
  ["text", "A POEM FOR TODAY", 14, 16, 1, 1, "ML", ACCENT],
  ["text", "{date}", 306, 16, 1, 1, "MR", MUTED],
  ["drawFastHLine", 14, 26, 292, "#C8B898"],
  // The poem, centred.
  ["text", "{r1}", 160, "{y1}", 2, 1, "TC", INK],
  ["text", "{r2}", 160, "{y2}", 2, 1, "TC", INK],
  ["text", "{r3}", 160, "{y3}", 2, 1, "TC", INK],
  ["text", "{r4}", 160, "{y4}", 2, 1, "TC", INK],
  ["text", "{r5}", 160, "{y5}", 2, 1, "TC", INK],
  ["text", "{r6}", 160, "{y6}", 2, 1, "TC", INK],
  ["text", "{r7}", 160, "{y7}", 2, 1, "TC", INK],
  ["text", "{r8}", 160, "{y8}", 2, 1, "TC", INK],
  // Ornament rule, then title and author.
  ["drawFastHLine", 120, 196, 30, ACCENT],
  ["fillCircle", 160, 196, 2, ACCENT],
  ["drawFastHLine", 170, 196, 30, ACCENT],
  ["text", "{poem_title}", 160, 203, 2, 1, "TC", ACCENT],
  ["text", "{poem_author}", 160, 222, 1, 1, "TC", MUTED],
];

const template: Template = {
  id: "poem-quatrain",
  name: "Four-line poem",
  description: "A short four-line poem each day, centred on a cream page with its title and poet.",
  apis: ["PoetryDB"],
  category: "fun",
  dataCode: code,
  rows: rows("poem-quatrain", wire),
  sampleVars: {"date":"Sat 21/11","poem_author":"ROBERT HERRICK","poem_title":"Upon His Sister-in-Law, Mistress Elizabeth...","r1":"First, for effusions due unto the dead,","r2":"My solemn vows have here accomplished;","r3":"Next, how I love thee, that my grief must tell,","r4":"Wherein thou liv'st for ever.--Dear, farewell!","r5":"","r6":"","r7":"","r8":"","y1":64,"y2":90,"y3":116,"y4":142,"y5":-200,"y6":-200,"y7":-200,"y8":-200},
};

export default template;
