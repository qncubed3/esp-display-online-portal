import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Latest xkcd comic as text: number, title, date and the alt (hover) text

const LINES = 9; // alt text line slots

const dataCode = String.raw`// The newest xkcd comic from xkcd.com/info.0.json (no key). The device can't
// draw the comic itself, so this shows its number, title, date and alt text.
// New comics come out Monday, Wednesday and Friday, so an hour's cache is plenty.
const CACHE = 3600; // seconds
const TITLE_PX = 304; // room for a title line, font 4
const TEXT_PX = 304; // room for an alt-text line, font 2
const LINES = 9; // alt text line slots
const PITCH = 17; // px between alt-text lines
const BOTTOM = 234; // alt text must end above this y
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
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]/g, "")
    .trim();
}

// Word-wrap to lines no wider than px.
function wrap(s, px, w) {
  const lines = [];
  let line = "";
  for (const word of s.split(" ").filter(Boolean)) {
    const next = line ? line + " " + word : word;
    if (line && w(next) > px) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Cut a line so that line + "..." fits.
function ellipsis(s, px, w) {
  while (s.length && w(s + "...") > px) s = s.slice(0, -1);
  return s.trimEnd() + "...";
}

let comic = null;
try {
  comic = await get("https://xkcd.com/info.0.json", { cache: CACHE });
} catch (e) {
  console.log("xkcd failed:", e.message);
}

let num = "#----";
let date = "--";
let title = "xkcd unavailable";
let alt = "Couldn't reach xkcd.com just now. The newest comic will show here on the next update.";
if (comic && comic.num) {
  num = "#" + comic.num;
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = Number(comic.month);
  date = (m >= 1 && m <= 12) ? Number(comic.day) + " " + MONTHS[m - 1] + " " + comic.year : "--";
  title = ascii(comic.safe_title || comic.title) || "Untitled";
  alt = ascii(comic.alt) || "(no alt text)";
}

// Title: font 4, up to two lines.
let tl = wrap(title, TITLE_PX, w4);
if (tl.length > 2) tl = [tl[0], ellipsis(tl[1] + " " + tl[2], TITLE_PX, w4)];
export const title1 = tl[0] || "";
export const title2 = tl[1] || "";
export const title2_y = tl.length > 1 ? 76 : HIDE;
const ruleY = 50 + tl.length * 26 + 4;
export const rule_y = ruleY;

// Alt text: as many lines as fit; cut the last one with "..." if it runs over.
const first = ruleY + 7;
const room = Math.max(1, Math.min(LINES, Math.floor((BOTTOM - first - 16) / PITCH) + 1));
let lines = wrap(alt, TEXT_PX, w2);
if (lines.length > room) {
  lines = lines.slice(0, room);
  lines[room - 1] = ellipsis(lines[room - 1], TEXT_PX, w2);
}
const ly = (i) => (i < lines.length ? first + i * PITCH : HIDE);
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "";
export const l4 = lines[3] || "", l5 = lines[4] || "", l6 = lines[5] || "";
export const l7 = lines[6] || "", l8 = lines[7] || "", l9 = lines[8] || "";
export const y1 = ly(0), y2 = ly(1), y3 = ly(2), y4 = ly(3), y5 = ly(4), y6 = ly(5), y7 = ly(6), y8 = ly(7), y9 = ly(8);
export const comic_num = num;
export const comic_date = date;
export const clock = now("HH:mm");
`;

const INK = "#1A1A1A";
const PAPER = "#F6F6F2";
const ACCENT = "#6E7B91"; // xkcd.com's slate blue

const lineRows: RawWireOp[] = [];
for (let i = 1; i <= LINES; i++) lineRows.push(["text", `{l${i}}`, 8, `{y${i}}`, 2, 1, "TL", "#3A3A3A"]);

const wire: RawWireOp[] = [
  ["fillScreen", PAPER],
  ["fillRect", 0, 0, 320, 24, INK],
  // A small stick figure beside the name.
  ["drawCircle", 14, 7, 3, "#FFFFFF"],
  ["drawLine", 14, 10, 14, 16, "#FFFFFF"],
  ["drawLine", 14, 12, 10, 15, "#FFFFFF"],
  ["drawLine", 14, 12, 18, 15, "#FFFFFF"],
  ["drawLine", 14, 16, 11, 21, "#FFFFFF"],
  ["drawLine", 14, 16, 17, 21, "#FFFFFF"],
  ["text", "xkcd", 26, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "LATEST COMIC", 64, 12, 1, 1, "ML", "#A8B2C4"],
  ["text", "{clock}", 312, 12, 2, 1, "MR", "#A8B2C4"],
  ["text", "{comic_num}", 8, 31, 2, 1, "TL", ACCENT],
  ["text", "{comic_date}", 312, 31, 2, 1, "TR", ACCENT],
  ["text", "{title1}", 8, 50, 4, 1, "TL", INK],
  ["text", "{title2}", 8, "{title2_y}", 4, 1, "TL", INK],
  ["drawFastHLine", 8, "{rule_y}", 304, "#B8BCC4"],
  ...lineRows,
];

const template: Template = {
  id: "xkcd-latest",
  name: "Latest xkcd",
  description: "The newest xkcd comic as text: number, title, date and its alt-text punchline.",
  apis: ["xkcd"],
  category: "fun",
  dataCode,
  rows: rows("xkcd-latest", wire),
  sampleVars: {"clock":"01:23","comic_date":"18 Nov 2026","comic_num":"#3326","l1":"[Several months later] Actually, it looks like","l2":"what it hit a few months ago was just the","l3":"START of the crystal sphere zone. New data","l4":"confirms Voyager 1 has now struck the ACTUAL","l5":"crystal sphere.","l6":"","l7":"","l8":"","l9":"","rule_y":80,"title1":"Voyager Crash","title2":"","title2_y":-200,"y1":87,"y2":104,"y3":121,"y4":138,"y5":155,"y6":-200,"y7":-200,"y8":-200,"y9":-200},
};

export default template;
