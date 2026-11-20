import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Wikipedia's "Did you know..." hooks from the main page: one hook per minute, as large as fits.

const code = String.raw`// "Did you know..." hooks from English Wikipedia's main page, via the Wikimedia REST
// featured feed (free, no key). The feed changes at 00:00 UTC, so today's UTC date is asked for;
// if it has no hooks yet, yesterday's are used. A different hook shows each minute.
const ROTATE_MINUTES = 1; // how many minutes each hook stays on screen

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
let hooks = [];
for (const off of [0, 1]) {
  try {
    const res = await get("https://en.wikipedia.org/api/rest_v1/feed/featured/" + day(off), { cache: 21600 });
    if (res && Array.isArray(res.dyk) && res.dyk.length) { hooks = res.dyk; break; }
  } catch (e) {
    console.log("wikipedia dyk failed:", e.message);
  }
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
const strip = (h) => String(h || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const n = hooks.length;
const minutes = Number(now("HH")) * 60 + Number(now("mm"));
const idx = n ? Math.floor(minutes / ROTATE_MINUTES) % n : 0;
const hook = hooks[idx] || {};
// "... that X?" becomes "...that" (drawn as the lead-in) and "X?".
let text = ascii(hook.text || strip(hook.html)).replace(/^\.\.\.\s*that\s+/i, "");
if (text) text = text[0].toUpperCase() + text.slice(1);
// The bold link in the hook is the new article it promotes.
const bold = String(hook.html || "").match(/<b[^>]*>([\s\S]*?)<\/b>/);
const article = bold ? ascii(strip((bold[1].match(/title="([^"]+)"/) || [])[1] || bold[1])) : "";

// Glyph widths (chars 32-126) of font 2 and font 4, so lines wrap to real pixels.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (s, W) => { let w = 0; for (const c of s) w += W[c.charCodeAt(0) - 32] || 8; return w; };
const wrap = (t, maxW, W) => {
  const lines = [];
  let line = "";
  for (const w of t.split(" ").filter(Boolean)) {
    const next = line ? line + " " + w : w;
    if (line && width(next, W) > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
};
const fits = (ls, maxW, W) => ls.every((l) => width(l, W) <= maxW);
const ellipsize = (s, maxW, W) => {
  if (width(s, W) <= maxW) return s;
  while (s && width(s + "...", W) > maxW) s = s.slice(0, -1);
  return s.trimEnd() + "...";
};

// The lead-in plus hook are centred in y 38 to 198: font 4 in up to 5 lines, else font 2 in up to 8 (truncated).
const MAXW = 300, TOP = 38, BOTTOM = 198, LEAD = 20; // LEAD: lead-in line height
const body = text || "Couldn't load Wikipedia. Trying again soon.";
let font = 4, pitch = 27, lines = wrap(body, MAXW, W4);
if (lines.length > 5 || !fits(lines, MAXW, W4)) {
  font = 2;
  pitch = 18;
  lines = wrap(body, MAXW, W2);
  if (lines.length > 8) {
    lines.length = 8;
    let last = lines[7];
    while (last && width(last + "...", W2) > MAXW) last = last.replace(/\s*\S+$/, "");
    lines[7] = last.replace(/[\s,;:.]+$/, "") + "...";
  }
  lines = lines.map((l) => ellipsize(l, MAXW, W2));
}
const glyphH = font === 4 ? 26 : 16;
const leadH = text ? LEAD : 0;
const top = Math.round(TOP + (BOTTOM - TOP - (leadH + (lines.length - 1) * pitch + glyphH)) / 2) + leadH;
export const hook_font = font;
export const l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "", l4 = lines[3] || "";
export const l5 = lines[4] || "", l6 = lines[5] || "", l7 = lines[6] || "", l8 = lines[7] || "";
const ly = (i) => (lines[i] ? top + i * pitch : -200);
export const y1 = ly(0), y2 = ly(1), y3 = ly(2), y4 = ly(3), y5 = ly(4), y6 = ly(5), y7 = ly(6), y8 = ly(7);
export const lead = text ? "...that" : "";
export const lead_y = text ? top - LEAD : -200;
export const article_line = article ? ellipsize("Read: " + article, MAXW, W2) : "";
export const counter = n ? (idx + 1) + " of " + n : "";
export const time = now("HH:mm");
`;

const BG = "#0C1420";
const BAR = "#1E3A5F";
const ACCENT = "#7FC4FF";
const TEXT = "#FFFFFF";
const MUTED = "#7A8A9A";

const line = (v: string, y: string): RawWireOp =>
  ["text", `{${v}}`, 10, `{${y}}`, "{hook_font}", 1, "TL", TEXT];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: a "?" badge, title, counter and time.
  ["fillRect", 0, 0, 320, 30, BAR],
  ["fillCircle", 18, 15, 10, ACCENT],
  ["text", "?", 18, 16, 2, 1, "MC", BAR],
  ["text", "Did you know...", 36, 15, 2, 1, "ML", TEXT],
  ["text", "{counter}", 250, 15, 1, 1, "MR", "#A8C0D8"],
  ["text", "{time}", 312, 15, 2, 1, "MR", "#A8C0D8"],
  // Lead-in, then the hook.
  ["text", "{lead}", 10, "{lead_y}", 2, 1, "TL", ACCENT],
  line("l1", "y1"),
  line("l2", "y2"),
  line("l3", "y3"),
  line("l4", "y4"),
  line("l5", "y5"),
  line("l6", "y6"),
  line("l7", "y7"),
  line("l8", "y8"),
  // The article the hook promotes, and the credit.
  ["drawFastHLine", 10, 202, 300, "#2A3A4E"],
  ["text", "{article_line}", 10, 208, 2, 1, "TL", ACCENT],
  ["text", "en.wikipedia.org  CC BY-SA", 10, 234, 1, 1, "BL", MUTED],
];

const template: Template = {
  id: "wiki-did-you-know",
  name: "Did you know...?",
  description: "Wikipedia's \"Did you know...\" hooks from today's main page, a new one each minute.",
  apis: ["Wikipedia"],
  category: "fun",
  dataCode: code,
  rows: rows("wiki-did-you-know", wire),
  sampleVars: {"article_line":"Read: Initial Deed (Providence)","counter":"3 of 9","hook_font":4,"l1":"The Initial Deed was so","l2":"named because the","l3":"grantees were identified","l4":"only by their initials?","l5":"","l6":"","l7":"","l8":"","lead":"...that","lead_y":55,"time":"01:20","y1":75,"y2":102,"y3":129,"y4":156,"y5":-200,"y6":-200,"y7":-200,"y8":-200},
};

export default template;
