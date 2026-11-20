import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// A multiple-choice trivia question from Open Trivia DB (free, no key).
// The question changes every 10 minutes; the answer is revealed in green
// for the second half of each 10-minute window, so there's time to guess.
const REVEAL_AT = 5; // minute within each 10-minute window when the answer shows

// Font 2 character widths (from src/lib/draw/fonts.ts), indexed by char code - 32.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const width = (s) => { let w = 0; for (const c of s) w += W2[c.charCodeAt(0) - 32] || 8; return w; };

// url3986 encoding avoids HTML entities; decode any stray ones too, then force ASCII.
const ENT = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: "...", ndash: "-", mdash: "-", eacute: "e", shy: "" };
const clean = (s) => {
  let t = String(s || "");
  try { t = decodeURIComponent(t); } catch (e) {}
  t = t.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENT ? ENT[n] : m));
  try { t = t.normalize("NFD"); } catch (e) {}
  return t.replace(/[̀-ͯ]/g, "")
    .replace(/[‘’´]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/ß/g, "ss").replace(/[øØ]/g, "o")
    .replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
};

let category = "No data";
let difficulty = "easy";
let question = "Trivia is unavailable right now. Check back in a few minutes.";
let correct = "--";
let answers = ["--", "--", "--", "--"];
let ok = false;
try {
  const res = await get("https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986", { cache: 600 });
  const r = res && res.response_code === 0 && res.results && res.results[0];
  if (r && r.question && r.correct_answer && Array.isArray(r.incorrect_answers)) {
    category = clean(r.category).replace(/^(Entertainment|Science): /, "");
    difficulty = clean(r.difficulty).toLowerCase();
    question = clean(r.question);
    correct = clean(r.correct_answer);
    answers = [correct].concat(r.incorrect_answers.map(clean)).slice(0, 4);
    while (answers.length < 4) answers.push("--");
    ok = true;
  }
} catch (e) {
  console.log("trivia failed:", e.message);
}

// Deterministic shuffle: order by a hash of question + answer.
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
if (ok) answers.sort((a, b) => hash(question + "|" + a) - hash(question + "|" + b));

// Word-wrap the question to font 2 within 304 px, up to 4 lines.
const MAX_W = 304, MAX_LINES = 4, PITCH = 19;
const lines = [];
let line = "";
for (const w of question.split(" ")) {
  const next = line ? line + " " + w : w;
  if (line && width(next) > MAX_W) { lines.push(line); line = w; } else line = next;
}
if (line) lines.push(line);
if (lines.length > MAX_LINES) {
  lines.length = MAX_LINES;
  let last = lines[MAX_LINES - 1];
  while (last && width(last + "...") > MAX_W) last = last.slice(0, -1);
  lines[MAX_LINES - 1] = last.trim() + "...";
}
const fit = (s, max) => {
  if (width(s) <= max) return s;
  let t = s;
  while (t && width(t + "...") > max) t = t.slice(0, -1);
  return t.trim() + "...";
};

// Question block centred in y 50..128.
const qTop = Math.round(50 + (78 - (lines.length * PITCH - 3)) / 2);
export const q1 = lines[0] || "", q2 = lines[1] || "", q3 = lines[2] || "", q4 = lines[3] || "";
export const q1_y = qTop, q2_y = qTop + PITCH, q3_y = qTop + 2 * PITCH, q4_y = qTop + 3 * PITCH;

// Pills: category then difficulty (font 1, 6 px per char).
export const cat = fit(category, 200).toUpperCase();
export const cat_w = cat.length * 6 + 12;
export const diff = difficulty.toUpperCase();
export const diff_x = ok ? 8 + cat_w + 6 : -200;
export const diff_w = diff.length * 6 + 12;
export const diff_tx = diff_x + Math.round(diff_w / 2);
export const cat_tx = 8 + Math.round(cat_w / 2);
export const diff_bg = difficulty === "hard" ? "#B03030" : difficulty === "medium" ? "#B07810" : "#2E8040";

// Reveal in the second half of each 10-minute window.
const mm = Number(now("mm")) || 0;
const reveal = ok && mm % 10 >= REVEAL_AT;
export const status = !ok ? "" : reveal ? "Answer revealed" : "Answer in " + (REVEAL_AT - (mm % 10)) + "m";
export const status_col = reveal ? "#60E080" : "#FFB000";

const L = ["A", "B", "C", "D"];
const out = {};
answers.forEach((a, i) => {
  const isRight = reveal && a === correct;
  out["a" + (i + 1)] = fit(a, 268);
  out["a" + (i + 1) + "_bg"] = isRight ? "#1E7A3A" : reveal ? "#151A24" : "#222A3A";
  out["a" + (i + 1) + "_fg"] = isRight ? "#FFFFFF" : reveal ? "#8090A0" : "#FFFFFF";
  out["a" + (i + 1) + "_badge"] = isRight ? "#FFFFFF" : reveal ? "#5A6270" : "#FFB000";
  out["a" + (i + 1) + "_lc"] = isRight ? "#1E7A3A" : "#000000";
});
export const a1 = out.a1, a2 = out.a2, a3 = out.a3, a4 = out.a4;
export const a1_bg = out.a1_bg, a2_bg = out.a2_bg, a3_bg = out.a3_bg, a4_bg = out.a4_bg;
export const a1_fg = out.a1_fg, a2_fg = out.a2_fg, a3_fg = out.a3_fg, a4_fg = out.a4_fg;
export const a1_badge = out.a1_badge, a2_badge = out.a2_badge, a3_badge = out.a3_badge, a4_badge = out.a4_badge;
export const a1_lc = out.a1_lc, a2_lc = out.a2_lc, a3_lc = out.a3_lc, a4_lc = out.a4_lc;
`;

// Answer row: box, letter badge, letter, answer text.
const answerRow = (n: number, y: number): RawWireOp[] => [
  ["fillRoundRect", 8, y, 304, 23, 4, `{a${n}_bg}`],
  ["fillRoundRect", 12, y + 3, 17, 17, 3, `{a${n}_badge}`],
  ["text", "ABCD"[n - 1], 21, y + 12, 2, 1, "MC", `{a${n}_lc}`],
  ["text", `{a${n}}`, 36, y + 12, 2, 1, "ML", `{a${n}_fg}`],
];

const wire: RawWireOp[] = [
  ["fillScreen", "#0B0F18"],
  ["fillRect", 0, 0, 320, 26, "#2A1F4A"],
  ["text", "TRIVIA", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{status}", 312, 13, 2, 1, "MR", "{status_col}"],
  ["fillRoundRect", 8, 32, "{cat_w}", 14, 7, "#3A4660"],
  ["text", "{cat}", "{cat_tx}", 39, 1, 1, "MC", "#E0E6F0"],
  ["fillRoundRect", "{diff_x}", 32, "{diff_w}", 14, 7, "{diff_bg}"],
  ["text", "{diff}", "{diff_tx}", 39, 1, 1, "MC", "#FFFFFF"],
  ["text", "{q1}", 160, "{q1_y}", 2, 1, "TC", "#FFFFFF"],
  ["text", "{q2}", 160, "{q2_y}", 2, 1, "TC", "#FFFFFF"],
  ["text", "{q3}", 160, "{q3_y}", 2, 1, "TC", "#FFFFFF"],
  ["text", "{q4}", 160, "{q4_y}", 2, 1, "TC", "#FFFFFF"],
  ...answerRow(1, 132),
  ...answerRow(2, 158),
  ...answerRow(3, 184),
  ...answerRow(4, 210),
];

const template: Template = {
  id: "trivia-question",
  name: "Trivia question",
  description: "A multiple-choice trivia question every 10 minutes, with the answer revealed in green halfway through.",
  apis: ["Open Trivia DB"],
  category: "fun",
  dataCode: code,
  rows: rows("trivia-question", wire),
  sampleVars: {"a1":"Gold Rush","a1_badge":"#5A6270","a1_bg":"#151A24","a1_fg":"#8090A0","a1_lc":"#000000","a2":"Upward","a2_badge":"#5A6270","a2_bg":"#151A24","a2_fg":"#8090A0","a2_lc":"#000000","a3":"Gravel Pit","a3_badge":"#FFFFFF","a3_bg":"#1E7A3A","a3_fg":"#FFFFFF","a3_lc":"#1E7A3A","a4":"Hoodoo","a4_badge":"#5A6270","a4_bg":"#151A24","a4_fg":"#8090A0","a4_lc":"#000000","cat":"VIDEO GAMES","cat_tx":47,"cat_w":78,"diff":"EASY","diff_bg":"#2E8040","diff_tx":110,"diff_w":36,"diff_x":92,"q1":"Which of the following was a map that was in","q1_y":72,"q2":"Team Fortress 2 at launch?","q2_y":91,"q3":"","q3_y":110,"q4":"","q4_y":129,"status":"Answer revealed","status_col":"#60E080"},
};

export default template;
