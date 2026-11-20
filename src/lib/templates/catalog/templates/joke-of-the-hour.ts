import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// A clean two-part joke every hour: the setup in one speech bubble, the punchline in another.
// Source: JokeAPI (safe mode, two-part only), falling back to the Official Joke API. Both keyless.
const MAX_LINES = 4; // per bubble
const TEXT_W = 252; // px of text per line inside a bubble (font 2)
const PITCH = 18; // px between lines

let setup = "Why don't skeletons fight each other?";
let punch = "They don't have the guts.";
let source = "built-in";
try {
  const j = await get(
    "https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart&blacklistFlags=nsfw,religious,political,racist,sexist,explicit",
    { cache: 3600 }
  );
  if (j && !j.error && j.setup && j.delivery) {
    setup = j.setup;
    punch = j.delivery;
    source = "jokeapi.dev";
  } else throw new Error("no joke");
} catch (e) {
  console.log("jokeapi failed:", e.message);
  try {
    const j = await get("https://official-joke-api.appspot.com/random_joke", { cache: 3600 });
    if (j && j.setup && j.punchline) {
      setup = j.setup;
      punch = j.punchline;
      source = "official-joke-api";
    }
  } catch (e2) {
    console.log("official-joke-api failed:", e2.message);
  }
}

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Font 2 glyph widths, char code 32..127.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const width = (s) => {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += W2[s.charCodeAt(i) - 32] || 7;
  return w;
};

// Word-wrap by pixel width; cut over-long words; ellipsis if it runs past MAX_LINES.
const wrap = (text) => {
  const out = [];
  let line = "";
  for (let w of ascii(text).split(" ").filter(Boolean)) {
    while (width(w) > TEXT_W) {
      let k = w.length;
      while (k > 1 && width(w.slice(0, k)) > TEXT_W) k--;
      if (line) { out.push(line); line = ""; }
      out.push(w.slice(0, k));
      w = w.slice(k);
    }
    const t = line ? line + " " + w : w;
    if (line && width(t) > TEXT_W) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  if (out.length > MAX_LINES) {
    out.length = MAX_LINES;
    let last = out[MAX_LINES - 1];
    while (last && width(last + "...") > TEXT_W) last = last.slice(0, -1);
    out[MAX_LINES - 1] = last.trimEnd() + "...";
  }
  return out.length ? out : ["..."];
};

const a = wrap(setup);
const b = wrap(punch);

// Bubble heights follow the line count; the pair is centred between the header (28) and the bottom (240).
const h1 = a.length * PITCH + 14;
const h2 = b.length * PITCH + 14;
const GAP = 22; // room for the tails
const top = Math.round(34 + (200 - (h1 + GAP + h2)) / 2);

export const s_y = top;
export const s_h = h1;
export const s_tail = top + h1 - 1; // tail base (overlaps bubble edge)
export const s_tip = top + h1 + 12;
export const p_y = top + h1 + GAP;
export const p_h = h2;
export const p_tail = p_y; // tail base
export const p_tip = p_y - 12;

export const s1 = a[0] || "", s2 = a[1] || "", s3 = a[2] || "", s4 = a[3] || "";
export const p1 = b[0] || "", p2 = b[1] || "", p3 = b[2] || "", p4 = b[3] || "";
export const s1_y = s_y + 8, s2_y = s_y + 8 + PITCH, s3_y = s_y + 8 + 2 * PITCH, s4_y = s_y + 8 + 3 * PITCH;
export const p1_y = p_y + 8, p2_y = p_y + 8 + PITCH, p3_y = p_y + 8 + 2 * PITCH, p4_y = p_y + 8 + 3 * PITCH;
export const time = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#101820"],
  ["fillRect", 0, 0, 320, 28, "#1E3A4A"],
  ["text", "JOKE OF THE HOUR", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{time}", 312, 14, 2, 1, "MR", "#9FD8E8"],
  // Setup bubble (left, light) with its tail pointing down-left.
  ["fillRoundRect", 8, "{s_y}", 272, "{s_h}", 10, "#E8EEF2"],
  ["fillTriangle", 28, "{s_tail}", 50, "{s_tail}", 22, "{s_tip}", "#E8EEF2"],
  ["text", "{s1}", 18, "{s1_y}", 2, 1, "TL", "#101820"],
  ["text", "{s2}", 18, "{s2_y}", 2, 1, "TL", "#101820"],
  ["text", "{s3}", 18, "{s3_y}", 2, 1, "TL", "#101820"],
  ["text", "{s4}", 18, "{s4_y}", 2, 1, "TL", "#101820"],
  // Punchline bubble (right, amber) with its tail pointing up-right.
  ["fillRoundRect", 40, "{p_y}", 272, "{p_h}", 10, "#FFB020"],
  ["fillTriangle", 270, "{p_tail}", 292, "{p_tail}", 298, "{p_tip}", "#FFB020"],
  ["text", "{p1}", 50, "{p1_y}", 2, 1, "TL", "#201000"],
  ["text", "{p2}", 50, "{p2_y}", 2, 1, "TL", "#201000"],
  ["text", "{p3}", 50, "{p3_y}", 2, 1, "TL", "#201000"],
  ["text", "{p4}", 50, "{p4_y}", 2, 1, "TL", "#201000"],
];

const template: Template = {
  id: "joke-of-the-hour",
  name: "Joke of the hour",
  description: "A clean two-part joke every hour, setup and punchline in two speech bubbles.",
  apis: ["JokeAPI", "Official Joke API"],
  category: "fun",
  dataCode: code,
  rows: rows("joke-of-the-hour", wire),
  sampleVars: {"p1":"I told her \"No, thanks. The carton works","p1_y":153,"p2":"fine\".","p2_y":171,"p3":"","p3_y":189,"p4":"","p4_y":207,"p_h":50,"p_tail":145,"p_tip":133,"p_y":145,"s1":"A grocery store cashier asked if I","s1_y":81,"s2":"would like my milk in a bag.","s2_y":99,"s3":"","s3_y":117,"s4":"","s4_y":135,"s_h":50,"s_tail":122,"s_tip":135,"s_y":73,"time":"14:00"},
};

export default template;
