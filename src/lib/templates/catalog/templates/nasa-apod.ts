import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// NASA Astronomy Picture of the Day, as text over a starfield

const LINES = 9; // explanation line slots

const dataCode = String.raw`// NASA Astronomy Picture of the Day (APOD) as text: title, date, copyright and the
// first sentences of the explanation. The device can't show the picture itself.
// DEMO_KEY is NASA's public no-signup key: 30 requests/hour and 50/day per IP,
// so the response is cached for 6 hours. For heavy use, get a free personal key at
// api.nasa.gov and put it in API_KEY below.
const API_KEY = "DEMO_KEY";
const CACHE = 21600; // seconds
const TITLE_PX = 304; // room for a title line, font 4
const TEXT_PX = 304; // room for an explanation line, font 2
const LINES = 9; // explanation line slots
const PITCH = 17; // px between explanation lines
const BOTTOM = 234; // explanation must end above this y
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

const URL = "https://api.nasa.gov/planetary/apod?api_key=" + API_KEY;
let apod = null;
try {
  apod = await get(URL, { cache: CACHE });
} catch (e) {
  console.log("APOD today failed:", e.message);
}
// Today's entry can 500 around NASA's midnight (US Eastern) before it is published: use yesterday's.
if (!apod || !apod.title) {
  try {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    apod = await get(URL + "&date=" + y, { cache: CACHE });
  } catch (e) {
    console.log("APOD yesterday failed:", e.message);
  }
}

let title = "Picture unavailable";
let meta = "NASA APOD is not answering";
let text = "The shared DEMO_KEY allows only 30 requests an hour and 50 a day, so it may be rate-limited. Try again later, or use a free personal key from api.nasa.gov.";
if (apod && apod.title) {
  title = ascii(apod.title) || "Untitled";
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(apod.date || "");
  const date = m ? Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1] : ascii(apod.date);
  const credit = ascii(apod.copyright);
  meta = credit ? date + "  (c) " + credit : date + "  Public domain";
  if (w2(meta) > TEXT_PX) meta = ellipsis(meta, TEXT_PX, w2);
  // Drop the "Tomorrow's picture: ..." teaser that APOD appends.
  text = ascii(apod.explanation).replace(/\s*Tomorrow's picture:.*$/i, "");
}

// Title: font 4, up to two lines.
let tl = wrap(title, TITLE_PX, w4);
if (tl.length > 2) tl = [tl[0], ellipsis(tl[1] + " " + tl[2], TITLE_PX, w4)];
export const title1 = tl[0] || "";
export const title2 = tl[1] || "";
export const title2_y = tl.length > 1 ? 58 : HIDE;
const metaY = 32 + tl.length * 26 + 4;
export const meta_line = meta;
export const meta_y = metaY;
export const rule_y = metaY + 20;

// Explanation: as many whole sentences as fit; if not even one does, cut it with "...".
const first = metaY + 26;
const room = Math.max(1, Math.min(LINES, Math.floor((BOTTOM - first - 16) / PITCH) + 1));
const sentences = text.replace(/([.!?]["')]*)\s+/g, "$1\u0001").split("\u0001");
let shown = "";
for (const s of sentences) {
  const next = (shown + " " + s.trim()).trim();
  if (wrap(next, TEXT_PX, w2).length > room) break;
  shown = next;
}
let lines;
if (shown) {
  lines = wrap(shown, TEXT_PX, w2);
} else {
  lines = wrap(text, TEXT_PX, w2).slice(0, room);
  lines[room - 1] = ellipsis(lines[room - 1] || "", TEXT_PX, w2);
}
const ly = (i) => (i < lines.length ? first + i * PITCH : HIDE);
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "";
export const l4 = lines[3] || "", l5 = lines[4] || "", l6 = lines[5] || "";
export const l7 = lines[6] || "", l8 = lines[7] || "", l9 = lines[8] || "";
export const y1 = ly(0), y2 = ly(1), y3 = ly(2), y4 = ly(3), y5 = ly(4), y6 = ly(5), y7 = ly(6), y8 = ly(7), y9 = ly(8);
export const clock = now("HH:mm");
`;

// Starfield: fixed pseudo-random stars (same every redraw), mostly dim, a few bright.
const stars: RawWireOp[] = [];
let seed = 20261121;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const STAR_COLORS = ["#262E4C", "#2E3858", "#3A4466", "#46527A", "#56648E"];
for (let i = 0; i < 70; i++) {
  const x = 2 + Math.floor(rnd() * 316);
  const y = 26 + Math.floor(rnd() * 212);
  const c = STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)];
  stars.push(["drawPixel", x, y, c]);
}
// Three brighter stars with a small cross glint.
for (const [x, y] of [[296, 44], [22, 150], [270, 214]] as const) {
  stars.push(["drawPixel", x, y, "#FFFFFF"]);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) stars.push(["drawPixel", x + dx, y + dy, "#6070A0"]);
}

const lineRows: RawWireOp[] = [];
for (let i = 1; i <= LINES; i++) lineRows.push(["text", `{l${i}}`, 8, `{y${i}}`, 2, 1, "TL", "#D8DCE8"]);

const wire: RawWireOp[] = [
  ["fillScreen", "#03050E"],
  ...stars,
  ["fillRect", 0, 0, 320, 24, "#101A3C"],
  ["text", "ASTRONOMY PICTURE OF THE DAY", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 12, 2, 1, "MR", "#9FB4FF"],
  ["text", "{title1}", 8, 32, 4, 1, "TL", "#FFFFFF"],
  ["text", "{title2}", 8, "{title2_y}", 4, 1, "TL", "#FFFFFF"],
  ["text", "{meta_line}", 8, "{meta_y}", 2, 1, "TL", "#FFC861"],
  ["drawFastHLine", 8, "{rule_y}", 304, "#2A3A70"],
  ...lineRows,
];

const template: Template = {
  id: "nasa-apod",
  name: "NASA picture of the day",
  description:
    "NASA's Astronomy Picture of the Day as text over a starfield: title, date, copyright and the first sentences of the explanation (uses the shared DEMO_KEY; for heavy use put a free personal key in secrets.NASA_KEY).",
  apis: ["NASA APOD"],
  category: "space",
  dataCode,
  rows: rows("nasa-apod", wire),
  sampleVars: {"clock":"01:05","l1":"On November 17, fans of interstellar spaceflight","l2":"around planet Earth were invited to shine a","l3":"message into the night sky. Traced by a","l4":"flashlight beam switched on and off, the dashes","l5":"and dots of a Morse code message captured in","l6":"this time exposure from the Emirates","l7":"Astronomical Observatory, are read V-G-R.","l8":"","l9":"","meta_line":"20 Nov 2026  Public domain","meta_y":62,"rule_y":82,"title1":"NASA Science","title2":"","title2_y":-200,"y1":88,"y2":105,"y3":122,"y4":139,"y5":156,"y6":173,"y7":190,"y8":-200,"y9":-200},
};

export default template;
