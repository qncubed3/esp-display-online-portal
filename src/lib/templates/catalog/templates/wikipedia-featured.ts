import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Wikipedia's featured article of the day

const code = String.raw`// Today's featured article on English Wikipedia, from the Wikimedia REST feed (free, no key).
// The featured article changes at 00:00 UTC, so the feed is asked for today's UTC date.
// The title is big (font 4, up to two lines); the first sentences of the summary are
// word-wrapped by pixel width below it, because Draw can't wrap.
const SENTENCES = 3; // how many sentences of the summary to show (at most)

const d = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
let title = "", desc = "", extract = "";
try {
  const res = await get("https://en.wikipedia.org/api/rest_v1/feed/featured/" + d, { cache: 21600 });
  const tfa = res && res.tfa;
  if (tfa) {
    title = (tfa.titles && tfa.titles.normalized) || tfa.title || "";
    desc = tfa.description || "";
    extract = tfa.extract || "";
  }
} catch (e) {
  console.log("wikipedia featured failed:", e.message);
}

// Fonts are ASCII only: drop accents, straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "D").replace(/đ/g, "d").replace(/Ł/g, "L").replace(/ł/g, "l")
    .replace(/Ø/g, "O").replace(/ø/g, "o").replace(/ß/g, "ss").replace(/Æ/g, "AE").replace(/æ/g, "ae")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
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
// The first few sentences (a sentence ends at . ! or ? followed by a space and a capital).
const sentences = extract.match(/[^.!?]+(?:[.!?]+["')]*)(?=\s+["'(]?[A-Z0-9]|\s*$)|[^.!?]+$/g) || [];
const summary = sentences.slice(0, SENTENCES).join("").trim();

const MAXW = 304, PITCH = 18, BOTTOM = 222; // extract lines must end above the footer
const tl = title ? wrap(title, MAXW, 2, W4) : ["No article today"];
export const t1 = tl[0] || "", t2 = tl[1] || "";
let y = 36 + tl.length * 26;
export const desc_line = desc ? wrap(desc, MAXW, 1, W2)[0] : "";
export const desc_y = desc ? y + 2 : -200;
if (desc) y += 20;
y += 8;
const maxLines = Math.max(1, Math.floor((BOTTOM - y) / PITCH));
const el = summary ? wrap(summary, MAXW, maxLines, W2) : [title ? "" : "Couldn't load Wikipedia. Trying again soon."];
const ly = (i) => (el[i] ? y + i * PITCH : -200);
export const e1 = el[0] || "", e2 = el[1] || "", e3 = el[2] || "", e4 = el[3] || "";
export const e5 = el[4] || "", e6 = el[5] || "", e7 = el[6] || "", e8 = el[7] || "";
export const y1 = ly(0), y2 = ly(1), y3 = ly(2), y4 = ly(3), y5 = ly(4), y6 = ly(5), y7 = ly(6), y8 = ly(7);
export const date = now("ddd DD/MM");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#2A2A2A"],
  ["text", "Wikipedia - Today's featured article", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{t1}", 8, 36, 4, 1, "TL", "#FFFFFF"],
  ["text", "{t2}", 8, 62, 4, 1, "TL", "#FFFFFF"],
  ["text", "{desc_line}", 8, "{desc_y}", 2, 1, "TL", "#6FB0F0"],
  ["text", "{e1}", 8, "{y1}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e2}", 8, "{y2}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e3}", 8, "{y3}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e4}", 8, "{y4}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e5}", 8, "{y5}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e6}", 8, "{y6}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e7}", 8, "{y7}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e8}", 8, "{y8}", 2, 1, "TL", "#C8C8C8"],
  ["text", "en.wikipedia.org  CC BY-SA", 8, 236, 1, 1, "BL", "#606060"],
  ["text", "{date}", 312, 236, 1, 1, "BR", "#606060"],
];

const template: Template = {
  id: "wikipedia-featured",
  name: "Wikipedia featured article",
  description: "Today's featured Wikipedia article: its title in big type and the first few sentences.",
  apis: ["Wikipedia"],
  category: "news",
  dataCode: code,
  rows: rows("wikipedia-featured", wire),
  sampleVars: {"date":"Sat 21/11","desc_line":"South Vietnamese military officer and...","desc_y":64,"e1":"Lieutenant General Ton That Dinh was an","e2":"officer who served in the Army of the Republic","e3":"of Vietnam (ARVN). He is best known as one of","e4":"the key figures in the November 1963 coup that","e5":"led to the arrest and assassination of Ngo Dinh","e6":"Diem, the first president of the Republic of","e7":"Vietnam, commonly known as South Vietnam.","e8":"","t1":"Ton That Dinh","t2":"","y1":90,"y2":108,"y3":126,"y4":144,"y5":162,"y6":180,"y7":198,"y8":-200},
};

export default template;
