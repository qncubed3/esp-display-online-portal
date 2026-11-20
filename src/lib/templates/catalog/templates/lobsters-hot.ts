import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Lobsters hottest: six stories, each with its score, a one-line title, the first tag
// as a coloured pill and the comment count and domain beside it.

const ROW_Y = [30, 64, 98, 132, 166, 200]; // top of each 34 px story row

const code = String.raw`// The six hottest stories on Lobsters (lobste.rs/hottest.json, free, no key).
// Titles are cut to one line of font 2 and made plain ASCII for the device fonts.
const COUNT = 6;
const ROW_Y = [30, 64, 98, 132, 166, 200]; // top of each row in Draw
const TITLE_X = 40;
const TITLE_W = 272; // px for a title (x 40..312)

// Font 2 glyph widths for chars 32..126, so truncation matches the device.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

// Plain ASCII: curly quotes, dashes and the like become ASCII, accents are stripped, the rest dropped.
const MAP = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "«": '"', "»": '"',
  "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": "-", "−": "-",
  "…": "...", " ": " ", "×": "x", "•": "*", "·": "-",
  "→": "->", "←": "<-", "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o",
  "ł": "l", "€": "EUR", "£": "GBP", "°": " deg",
};
function ascii(s) {
  let t = String(s || "").replace(/[^\x00-\x7F]/g, (c) => (MAP[c] !== undefined ? MAP[c] : c));
  if (t.normalize) t = t.normalize("NFD");
  return t.replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

// Cut s so it fits in max px, ending in "..." when shortened.
function fit(s, max) {
  if (width(s) <= max) return s;
  let out = s;
  while (out && width(out + "...") > max) out = out.slice(0, -1);
  return out.replace(/[\s,;:.-]+$/, "") + "...";
}

// Each tag gets a stable colour from a small palette.
const PALETTE = ["#2E6FBF", "#2E8B57", "#7B4FB0", "#19808A", "#C0661A", "#B8312F", "#55606E", "#8A6D1F"];
function tagColour(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 1000;
  return PALETTE[h % PALETTE.length];
}

function domain(url) {
  const m = String(url || "").match(/^https?:\/\/(?:www\.)?([^\/:?#]+)/i);
  return m ? m[1] : "";
}

let stories = [];
let failed = false;
try {
  const res = await get("https://lobste.rs/hottest.json", { cache: 600 });
  if (Array.isArray(res)) stories = res;
  else failed = true;
} catch (e) {
  failed = true;
}

const out = {};
for (let i = 0; i < COUNT; i++) {
  const s = stories[i];
  const n = i + 1;
  const y = ROW_Y[i];
  let score = "", title = "", tag = "", meta = "";
  if (s && s.title) {
    score = String(s.score || 0);
    title = fit(ascii(s.title), TITLE_W);
    tag = ascii((s.tags && s.tags[0]) || "").slice(0, 14);
    const c = s.comment_count || 0;
    meta = c + (c === 1 ? " comment" : " comments");
    const d = domain(s.url);
    if (d) meta += "  " + d;
  } else if (i === 0) {
    title = failed ? "Lobsters is unavailable" : "No stories right now";
    meta = "Trying again soon";
  }
  const pillW = tag ? tag.length * 6 + 8 : 0;
  const metaX = tag ? TITLE_X + pillW + 6 : TITLE_X;
  // Font 1 is 6 px per char; keep the meta line inside the screen.
  const maxChars = Math.floor((312 - metaX) / 6);
  if (meta.length > maxChars) meta = meta.slice(0, Math.max(0, maxChars - 2)) + "..";
  out["s" + n + "_score"] = score;
  out["s" + n + "_title"] = title;
  out["s" + n + "_tag"] = tag;
  out["s" + n + "_tagc"] = tag ? tagColour(tag) : "#FFFFFF";
  out["s" + n + "_pw"] = pillW;
  out["s" + n + "_py"] = tag ? y + 19 : -200; // pill hides off-screen with no tag
  out["s" + n + "_by"] = score ? y + 4 : -200; // score box hides with no story
  out["s" + n + "_meta"] = meta;
  out["s" + n + "_mx"] = metaX;
}

export const s1_score = out.s1_score, s1_title = out.s1_title, s1_tag = out.s1_tag, s1_tagc = out.s1_tagc, s1_pw = out.s1_pw, s1_py = out.s1_py, s1_by = out.s1_by, s1_meta = out.s1_meta, s1_mx = out.s1_mx;
export const s2_score = out.s2_score, s2_title = out.s2_title, s2_tag = out.s2_tag, s2_tagc = out.s2_tagc, s2_pw = out.s2_pw, s2_py = out.s2_py, s2_by = out.s2_by, s2_meta = out.s2_meta, s2_mx = out.s2_mx;
export const s3_score = out.s3_score, s3_title = out.s3_title, s3_tag = out.s3_tag, s3_tagc = out.s3_tagc, s3_pw = out.s3_pw, s3_py = out.s3_py, s3_by = out.s3_by, s3_meta = out.s3_meta, s3_mx = out.s3_mx;
export const s4_score = out.s4_score, s4_title = out.s4_title, s4_tag = out.s4_tag, s4_tagc = out.s4_tagc, s4_pw = out.s4_pw, s4_py = out.s4_py, s4_by = out.s4_by, s4_meta = out.s4_meta, s4_mx = out.s4_mx;
export const s5_score = out.s5_score, s5_title = out.s5_title, s5_tag = out.s5_tag, s5_tagc = out.s5_tagc, s5_pw = out.s5_pw, s5_py = out.s5_py, s5_by = out.s5_by, s5_meta = out.s5_meta, s5_mx = out.s5_mx;
export const s6_score = out.s6_score, s6_title = out.s6_title, s6_tag = out.s6_tag, s6_tagc = out.s6_tagc, s6_pw = out.s6_pw, s6_py = out.s6_py, s6_by = out.s6_by, s6_meta = out.s6_meta, s6_mx = out.s6_mx;
export const clock = now("HH:mm");
`;

const BG = "#FEFEFE";
const RED = "#AC130D"; // Lobsters red
const INK = "#1A1A1A";
const GREY = "#6B6B6B";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header bar.
  ["fillRect", 0, 0, 320, 26, RED],
  ["text", "Lobsters", 8, 13, 2, 1, "ML", "#FFFFFF", ""],
  ["text", "Lobsters", 9, 13, 2, 1, "ML", "#FFFFFF", ""],
  ["text", "HOTTEST  {clock}", 312, 13, 2, 1, "MR", "#FFFFFF", ""],
  ...[1, 2, 3, 4, 5].map((i): RawWireOp => ["drawFastHLine", 8, ROW_Y[i] - 2, 304, "#E2E2E2"]),
  ...[1, 2, 3, 4, 5, 6].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      // Score in a soft box on the left.
      ["fillRoundRect", 8, `{s${n}_by}`, 26, 24, 4, "#F3E4E3"],
      ["text", `{s${n}_score}`, 21, y + 16, 2, 1, "MC", RED, ""],
      ["text", `{s${n}_title}`, 40, y + 1, 2, 1, "TL", INK, ""],
      // First tag as a coloured pill, then comments and domain.
      ["fillRoundRect", 40, `{s${n}_py}`, `{s${n}_pw}`, 11, 3, `{s${n}_tagc}`],
      ["text", `{s${n}_tag}`, 44, y + 21, 1, 1, "TL", "#FFFFFF", ""],
      ["text", `{s${n}_meta}`, `{s${n}_mx}`, y + 21, 1, 1, "TL", GREY, ""],
    ];
  }),
];

const template: Template = {
  id: "lobsters-hot",
  name: "Lobsters hottest",
  description: "The six hottest Lobsters stories with score, title, first tag as a coloured pill and comment count.",
  apis: ["Lobsters"],
  category: "tech",
  dataCode: code,
  rows: rows("lobsters-hot", wire),
  sampleVars: {"clock":"08:45","s1_by":34,"s1_meta":"6 comments  vim-classic.org","s1_mx":96,"s1_pw":50,"s1_py":49,"s1_score":"22","s1_tag":"editors","s1_tagc":"#55606E","s1_title":"Vim Classic 8.3.1 released","s2_by":68,"s2_meta":"25 comments  jschuster.org","s2_mx":72,"s2_pw":26,"s2_py":83,"s2_score":"45","s2_tag":"api","s2_tagc":"#7B4FB0","s2_title":"Design for Understandability","s3_by":102,"s3_meta":"0 comments  lwn.net","s3_mx":96,"s3_pw":50,"s3_py":117,"s3_score":"16","s3_tag":"android","s3_tagc":"#8A6D1F","s3_title":"Removing binder.c","s4_by":136,"s4_meta":"13 comments","s4_mx":72,"s4_pw":26,"s4_py":151,"s4_score":"7","s4_tag":"ask","s4_tagc":"#2E8B57","s4_title":"What are you doing this weekend?","s5_by":170,"s5_meta":"2 comments  dbushell.com","s5_mx":78,"s5_pw":32,"s5_py":185,"s5_score":"11","s5_tag":"a11y","s5_tagc":"#2E6FBF","s5_title":"Visited links are purple","s6_by":204,"s6_meta":"3 comments  postgresql.org","s6_mx":108,"s6_pw":62,"s6_py":219,"s6_score":"78","s6_tag":"databases","s6_tagc":"#2E6FBF","s6_title":"PostgreSQL 19 Released"},
};

export default template;
