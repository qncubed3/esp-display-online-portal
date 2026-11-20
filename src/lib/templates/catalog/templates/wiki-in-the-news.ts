import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Wikipedia's "In the news" box, one story per screen

const code = String.raw`// "In the news" stories from the English Wikipedia main page, via the Wikimedia REST
// featured feed (free, no key). One story per screen, changing every minute. The story's
// bold (main) article is shown big as a headline, the story itself word-wrapped below it.
// The feed is asked for today's UTC date; if it has no news yet, yesterday's is used.

const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
let news = [];
for (const off of [0, 1]) {
  try {
    const res = await get("https://en.wikipedia.org/api/rest_v1/feed/featured/" + day(off), { cache: 3600 });
    if (res && Array.isArray(res.news) && res.news.length) { news = res.news; break; }
  } catch (e) {
    console.log("wikipedia news failed:", e.message);
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
const entities = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
const strip = (html) => entities(String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, ""));

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
  return lines.map((l) => {
    if (width(l, W) <= maxW) return l;
    while (l && width(l + "...", W) > maxW) l = l.slice(0, -1);
    return l + "...";
  });
};

const stories = news
  .map((n) => {
    const raw = String((n && n.story) || "");
    const when = (raw.match(/<!--\s*([A-Za-z]{3,9}\s+\d{1,2})\s*-->/) || [])[1] || "";
    // The headline: the first bold link (the story's main article), else the first link.
    const bold = raw.match(/<b[^>]*>([\s\S]*?)<\/b>/);
    const head = ascii(strip(bold ? bold[1] : "")) ||
      ascii((n.links && n.links[0] && n.links[0].titles && n.links[0].titles.normalized) || "");
    // Drop picture notes such as "(pictured)" or "(rendering shown)".
    const text = ascii(strip(raw).replace(/\s*\((?:[^()]*\s)?(?:pictured|shown)\)/gi, ""));
    return { when: ascii(when), head, text };
  })
  .filter((s) => s.text);

const minute = Number(now("mm"));
const s = stories.length ? stories[minute % stories.length] : null;
export const page = stories.length > 1 ? (minute % stories.length) + 1 + "/" + stories.length : "";
export const when = s && s.when ? s.when : "";

const MAXW = 304, PITCH = 18, BOTTOM = 222;
const hl = s && s.head ? wrap(s.head, MAXW, 2, W4) : [];
export const h1 = hl[0] || "", h2 = hl[1] || "";
let y = 40 + hl.length * 26 + (hl.length ? 6 : 0);
export const rule_y = hl.length ? y - 4 : -200;
y += hl.length ? 4 : 0;
const maxLines = Math.max(1, Math.floor((BOTTOM - y) / PITCH));
const el = s ? wrap(s.text, MAXW, maxLines, W2) : ["Couldn't load Wikipedia's news.", "Trying again soon."];
const ly = (i) => (el[i] ? y + i * PITCH : -200);
export const e1 = el[0] || "", e2 = el[1] || "", e3 = el[2] || "", e4 = el[3] || "";
export const e5 = el[4] || "", e6 = el[5] || "", e7 = el[6] || "", e8 = el[7] || "";
export const y1 = ly(0), y2 = ly(1), y3 = ly(2), y4 = ly(3), y5 = ly(4), y6 = ly(5), y7 = ly(6), y8 = ly(7);
export const clock = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 28, "#3A1414"],
  ["text", "IN THE NEWS", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{when}", 160, 14, 2, 1, "MC", "#FF9A8A"],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#C8A8A8"],
  ["text", "{h1}", 8, 40, 4, 1, "TL", "#FFFFFF"],
  ["text", "{h2}", 8, 66, 4, 1, "TL", "#FFFFFF"],
  ["drawFastHLine", 8, "{rule_y}", 304, "#5A2A2A"],
  ["text", "{e1}", 8, "{y1}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e2}", 8, "{y2}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e3}", 8, "{y3}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e4}", 8, "{y4}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e5}", 8, "{y5}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e6}", 8, "{y6}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e7}", 8, "{y7}", 2, 1, "TL", "#C8C8C8"],
  ["text", "{e8}", 8, "{y8}", 2, 1, "TL", "#C8C8C8"],
  ["text", "en.wikipedia.org  CC BY-SA", 8, 236, 1, 1, "BL", "#606060"],
  ["text", "{page}", 312, 236, 1, 1, "BR", "#909090"],
];

const template: Template = {
  id: "wiki-in-the-news",
  name: "Wikipedia: In the news",
  description: "Stories from Wikipedia's \"In the news\" box, one per screen with its main article as a headline; changes every minute.",
  apis: ["Wikipedia"],
  category: "news",
  dataCode: code,
  rows: rows("wiki-in-the-news", wire),
  sampleVars: {"clock":"01:19","e1":"The Salvadoran military intervention in Haiti","e2":"intensifies with airstrikes on 400 Mawozo's","e3":"alleged headquarters and a deployment to the","e4":"Sylvio Cator Stadium.","e5":"","e6":"","e7":"","e8":"","h1":"Salvadoran military","h2":"intervention in Haiti","page":"4/4","rule_y":94,"when":"Nov 11","y1":102,"y2":120,"y3":138,"y4":156,"y5":-200,"y6":-200,"y7":-200,"y8":-200},
};

export default template;
