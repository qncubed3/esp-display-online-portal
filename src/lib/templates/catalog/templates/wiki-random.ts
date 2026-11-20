import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// A random Wikipedia article, new every few minutes

const code = String.raw`// A random English Wikipedia article from the Wikimedia REST API (free, no key).
// The response is cached for CACHE seconds, so the article changes about that often.
// The title is big (font 4, up to two lines), the short description is in the accent
// colour, and the summary is word-wrapped by pixel width below it, because Draw can't wrap.
const CACHE = 300; // seconds between new articles

let title = "", desc = "", extract = "", edited = "";
try {
  const res = await get("https://en.wikipedia.org/api/rest_v1/page/random/summary", { cache: CACHE });
  if (res && typeof res === "object") {
    title = (res.titles && res.titles.normalized) || res.title || "";
    desc = res.description || "";
    extract = res.extract || "";
    edited = res.timestamp || "";
  }
} catch (e) {
  console.log("wikipedia random failed:", e.message);
}

// Fonts are ASCII only: drop accents, straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "D").replace(/đ/g, "d").replace(/Ł/g, "L").replace(/ł/g, "l")
    .replace(/Ø/g, "O").replace(/ø/g, "o").replace(/ß/g, "ss").replace(/Æ/g, "AE").replace(/æ/g, "ae")
    .replace(/[‘’ʻʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Glyph widths (chars 32-126) of font 2 and font 4, so lines wrap to real pixels.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (s, W) => { let w = 0; for (const c of s) w += W[c.charCodeAt(0) - 32] || 8; return w; };
// Wrap to at most maxLines lines of maxW px; if the text doesn't fit, end the last line with "...".
const wrap = (text, maxW, maxLines, W) => {
  const lines = [];
  let line = "";
  for (const w of text.split(" ").filter(Boolean)) {
    const next = line ? line + " " + w : w;
    if (line && width(next, W) > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && width(last + "...", W) > maxW) last = last.replace(/\s*\S+$/, "");
    lines[maxLines - 1] = last.replace(/[\s,;:.]+$/, "") + "...";
  }
  // A single word wider than the line: cut it by characters.
  return lines.map((l) => {
    if (width(l, W) <= maxW) return l;
    while (l && width(l + "...", W) > maxW) l = l.slice(0, -1);
    return l + "...";
  });
};

title = ascii(title);
desc = ascii(desc);
extract = ascii(extract);
if (desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);

// Text starts right of the accent bar (x 16) and ends 8 px from the right edge.
const MAXW = 296, PITCH = 18, BOTTOM = 220; // summary lines must end above the footer
const tl = title ? wrap(title, MAXW, 2, W4) : ["No article"];
export const t1 = tl[0] || "", t2 = tl[1] || "";
let y = 38 + tl.length * 26;
export const desc_line = desc ? wrap(desc, MAXW, 1, W2)[0] : "";
export const desc_y = desc ? y + 1 : -200;
if (desc) y += 20;
y += 6;
// The accent bar runs beside the title and description.
export const bar_h = y - 6 - 38;
const maxLines = Math.max(1, Math.min(8, Math.floor((BOTTOM - y) / PITCH)));
const el = extract ? wrap(extract, MAXW, maxLines, W2) : [title ? "" : "Couldn't load Wikipedia. Trying again soon."];
const ly = (i) => (el[i] ? y + i * PITCH : -200);
export const e1 = el[0] || "", e2 = el[1] || "", e3 = el[2] || "", e4 = el[3] || "";
export const e5 = el[4] || "", e6 = el[5] || "", e7 = el[6] || "", e8 = el[7] || "";
export const y1 = ly(0), y2 = ly(1), y3 = ly(2), y4 = ly(3), y5 = ly(4), y6 = ly(5), y7 = ly(6), y8 = ly(7);
// Last edit date of the article, as DD/MM/YYYY.
export const edited_line = /^\d{4}-\d{2}-\d{2}/.test(edited)
  ? "Edited " + edited.slice(8, 10) + "/" + edited.slice(5, 7) + "/" + edited.slice(0, 4)
  : "";
export const time = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#2E2410"],
  ["text", "RANDOM WIKIPEDIA", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{time}", 312, 14, 2, 1, "MR", "#F0C060"],
  ["fillRect", 8, 38, 3, "{bar_h}", "#F0B040"],
  ["text", "{t1}", 16, 38, 4, 1, "TL", "#FFFFFF"],
  ["text", "{t2}", 16, 64, 4, 1, "TL", "#FFFFFF"],
  ["text", "{desc_line}", 16, "{desc_y}", 2, 1, "TL", "#F0B040"],
  ["text", "{e1}", 16, "{y1}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e2}", 16, "{y2}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e3}", 16, "{y3}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e4}", 16, "{y4}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e5}", 16, "{y5}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e6}", 16, "{y6}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e7}", 16, "{y7}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e8}", 16, "{y8}", 2, 1, "TL", "#C8C8C8"],
  ["text", "en.wikipedia.org  CC BY-SA", 8, 236, 1, 1, "BL", "#606060"],
  ["text", "{edited_line}", 312, 236, 1, 1, "BR", "#606060"],
];

const template: Template = {
  id: "wiki-random",
  name: "Random Wikipedia article",
  description: "A random Wikipedia article every five minutes: its title, short description and summary.",
  apis: ["Wikipedia"],
  category: "fun",
  dataCode: code,
  rows: rows("wiki-random", wire),
  sampleVars: {"bar_h":46,"desc_line":"Austrian-born actor (1902-1983)","desc_y":65,"e1":"Walter Slezak was an Austrian-born film and","e2":"stage actor active between 1922 and 1976.","e3":"He mainly appeared in German films before","e4":"migrating to the United States in 1930 and","e5":"performing in numerous Hollywood productions.","e6":"","e7":"","e8":"","edited_line":"Edited 30/06/2026","t1":"Walter Slezak","t2":"","time":"01:20","y1":90,"y2":108,"y3":126,"y4":144,"y5":162,"y6":-200,"y7":-200,"y8":-200},
};

export default template;
