import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Rising GitHub repos: the most-starred repos created in the last week.

const ROW_Y = [32, 73, 114, 155, 196]; // top of each 41 px row
const STAR_X = 241; // centre of the star icon
const STAR_R = 8;
const STAR_IR = 3.5;
// Distinct rounded y offsets of the star's vertices. Data exports one y var per offset per row,
// so a row without a repo can move its star off-screen. Must match OFFS in the Data code.
const OFFS = [-8, -3, -2, 1, 4, 6];

const code = String.raw`// The five most-starred GitHub repos created in the last DAYS days, from the GitHub search API (no key).
// GitHub allows 10 searches a minute and 60 core calls an hour per server IP, shared by every user,
// so keep the cache long.
const DAYS = 7; // how new a repo must be
const CACHE = 3600; // seconds
const ROW_Y = [32, 73, 114, 155, 196]; // top of each row in Draw
const NAME_X = 32; // left edge of the name line
const NAME_MAX = 196; // px for "owner/name" in font 2 (x 32..228, the stars start at 233)
const DESC_CHARS = 44; // font 1 is 6 px a char; line 2 runs to x 312
const OFFS = [-8, -3, -2, 1, 4, 6]; // star vertex y offsets, must match Draw
const STAR_CY = 15; // star centre below the row top
const HIDE = -200;

const LANG_COLS = {
  JavaScript: "#F1E05A", TypeScript: "#3178C6", Python: "#3572A5", Go: "#00ADD8", Rust: "#DEA584",
  Java: "#B07219", "C++": "#F34B7D", C: "#8E8E8E", "C#": "#178600", Ruby: "#CC342D", PHP: "#4F5D95",
  Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89E051", HTML: "#E34C26",
  CSS: "#663399", Vue: "#41B883", Lua: "#5A6FD8", "Jupyter Notebook": "#DA5B0B", Zig: "#EC915C",
};

// Font 2 glyph widths for chars 32..126, so truncation matches the device.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };

function fit(s, max) {
  if (width(s) <= max) return s;
  let out = s;
  while (out && width(out + "..") > max) out = out.slice(0, -1);
  return out + "..";
}

// Fonts are ASCII only: straighten quotes and dashes, drop everything else.
function ascii(s) {
  return String(s || "")
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 6126 -> "6.1k", 12345 -> "12k", 950 -> "950"
function compact(n) {
  if (typeof n !== "number") return "--";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e4) return Math.round(n / 1e3) + "k";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const since = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
let items = [];
let failed = false;
try {
  const res = await get(
    "https://api.github.com/search/repositories?q=created:%3E" + since + "&sort=stars&order=desc&per_page=5",
    { cache: CACHE },
  );
  if (res && Array.isArray(res.items)) items = res.items; else failed = true;
} catch (e) {
  console.log("github search failed:", e.message);
  failed = true;
}

const out = {};
for (let i = 0; i < 5; i++) {
  const r = items[i];
  const n = "r" + (i + 1);
  const y = ROW_Y[i];
  let owner = "", name = "", nameX = NAME_X, stars = "", desc = "", rank = "";
  let lang = "", dotY = HIDE, descX = NAME_X;
  if (r && r.name) {
    rank = String(i + 1);
    const o = ascii(r.owner && r.owner.login) + "/";
    const nm = ascii(r.name);
    if (width(o) + width(nm) <= NAME_MAX) { owner = o; name = nm; nameX = NAME_X + width(o); }
    else name = fit(nm, NAME_MAX);
    stars = compact(r.stargazers_count);
    lang = r.language || "";
    // Skip descriptions that are mostly non-Latin; they would be mostly blanks on the device.
    const raw = String(r.description || "");
    const plain = raw.replace(/[^\x20-\x7e]/g, "");
    let d = plain.length >= raw.length * 0.8 ? ascii(raw) : "";
    if (!d) d = "No description";
    const label = lang === "Jupyter Notebook" ? "Jupyter" : ascii(lang);
    const line = label ? label + " - " + d : d;
    const maxChars = label ? DESC_CHARS - 2 : DESC_CHARS;
    desc = line.length > maxChars ? line.slice(0, maxChars - 2).replace(/[\s,;:.-]+$/, "") + ".." : line;
    if (label) { dotY = y + 32; descX = NAME_X + 10; }
  } else if (i === 0) {
    name = failed ? "GitHub unavailable" : "No new repos yet";
    desc = failed ? "Rate limited or offline, retrying soon" : "";
  }
  out[n + "_rank"] = rank;
  out[n + "_owner"] = owner;
  out[n + "_name"] = name;
  out[n + "_nx"] = nameX;
  out[n + "_stars"] = stars;
  out[n + "_desc"] = desc;
  out[n + "_dx"] = descX;
  out[n + "_dot"] = dotY;
  out[n + "_col"] = LANG_COLS[lang] || "#8B949E";
  for (let k = 0; k < OFFS.length; k++) out[n + "_s" + k] = stars ? y + STAR_CY + OFFS[k] : HIDE;
}

export const r1_rank = out.r1_rank, r1_owner = out.r1_owner, r1_name = out.r1_name, r1_nx = out.r1_nx, r1_stars = out.r1_stars, r1_desc = out.r1_desc, r1_dx = out.r1_dx, r1_dot = out.r1_dot, r1_col = out.r1_col;
export const r2_rank = out.r2_rank, r2_owner = out.r2_owner, r2_name = out.r2_name, r2_nx = out.r2_nx, r2_stars = out.r2_stars, r2_desc = out.r2_desc, r2_dx = out.r2_dx, r2_dot = out.r2_dot, r2_col = out.r2_col;
export const r3_rank = out.r3_rank, r3_owner = out.r3_owner, r3_name = out.r3_name, r3_nx = out.r3_nx, r3_stars = out.r3_stars, r3_desc = out.r3_desc, r3_dx = out.r3_dx, r3_dot = out.r3_dot, r3_col = out.r3_col;
export const r4_rank = out.r4_rank, r4_owner = out.r4_owner, r4_name = out.r4_name, r4_nx = out.r4_nx, r4_stars = out.r4_stars, r4_desc = out.r4_desc, r4_dx = out.r4_dx, r4_dot = out.r4_dot, r4_col = out.r4_col;
export const r5_rank = out.r5_rank, r5_owner = out.r5_owner, r5_name = out.r5_name, r5_nx = out.r5_nx, r5_stars = out.r5_stars, r5_desc = out.r5_desc, r5_dx = out.r5_dx, r5_dot = out.r5_dot, r5_col = out.r5_col;
export const r1_s0 = out.r1_s0, r1_s1 = out.r1_s1, r1_s2 = out.r1_s2, r1_s3 = out.r1_s3, r1_s4 = out.r1_s4, r1_s5 = out.r1_s5;
export const r2_s0 = out.r2_s0, r2_s1 = out.r2_s1, r2_s2 = out.r2_s2, r2_s3 = out.r2_s3, r2_s4 = out.r2_s4, r2_s5 = out.r2_s5;
export const r3_s0 = out.r3_s0, r3_s1 = out.r3_s1, r3_s2 = out.r3_s2, r3_s3 = out.r3_s3, r3_s4 = out.r3_s4, r3_s5 = out.r3_s5;
export const r4_s0 = out.r4_s0, r4_s1 = out.r4_s1, r4_s2 = out.r4_s2, r4_s3 = out.r4_s3, r4_s4 = out.r4_s4, r4_s5 = out.r4_s5;
export const r5_s0 = out.r5_s0, r5_s1 = out.r5_s1, r5_s2 = out.r5_s2, r5_s3 = out.r5_s3, r5_s4 = out.r5_s4, r5_s5 = out.r5_s5;
export const window_label = DAYS === 7 ? "NEW THIS WEEK" : "LAST " + DAYS + " DAYS";
export const clock = now("HH:mm");
`;

// Five-pointed star whose vertex y values are vars (one per distinct offset), so Data can hide it.
function star(n: number): RawWireOp[] {
  const pt = (i: number, rad: number): [number, string] => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const dy = Math.round(rad * Math.sin(a));
    const k = OFFS.indexOf(dy);
    if (k < 0) throw new Error("github-rising: star offset " + dy + " missing from OFFS");
    return [Math.round(STAR_X + rad * Math.cos(a)), `{r${n}_s${k}}`];
  };
  const outer = [0, 2, 4, 6, 8].map((i) => pt(i, STAR_R));
  const inner = [1, 3, 5, 7, 9].map((i) => pt(i, STAR_IR));
  const ops: RawWireOp[] = [];
  for (let k = 0; k < 5; k++) {
    const a = inner[(k + 4) % 5], b = outer[k], c = inner[k];
    ops.push(["fillTriangle", a[0], a[1], b[0], b[1], c[0], c[1], GOLD]);
  }
  for (const k of [1, 2, 3]) {
    ops.push(["fillTriangle", inner[0][0], inner[0][1], inner[k][0], inner[k][1], inner[k + 1][0], inner[k + 1][1], GOLD]);
  }
  return ops;
}

const BG = "#0D1117";
const CARD = "#161B22";
const LINE = "#30363D";
const GREY = "#8B949E";
const BLUE = "#58A6FF";
const GOLD = "#E3B341";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 28, CARD],
  ["drawFastHLine", 0, 28, 320, LINE],
  ["text", "Rising on GitHub", 10, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{window_label}  {clock}", 310, 14, 2, 1, "MR", GREY],
  ...[1, 2, 3, 4].map((i): RawWireOp => ["drawFastHLine", 8, ROW_Y[i] - 1, 304, "#21262D"]),
  ...[1, 2, 3, 4, 5].flatMap((n): RawWireOp[] => {
    const y = ROW_Y[n - 1];
    return [
      ["text", `{r${n}_rank}`, 16, y + 5, 2, 1, "TC", GREY],
      ["text", `{r${n}_owner}`, 32, y + 4, 2, 1, "TL", BLUE],
      ["text", `{r${n}_name}`, `{r${n}_nx}`, y + 4, 2, 1, "TL", "#FFFFFF"],
      ...star(n),
      ["text", `{r${n}_stars}`, 252, y + 3, 4, 1, "TL", "#FFFFFF"],
      ["fillCircle", 35, `{r${n}_dot}`, 3, `{r${n}_col}`],
      ["text", `{r${n}_desc}`, `{r${n}_dx}`, y + 29, 1, 1, "TL", GREY],
    ];
  }),
];

const template: Template = {
  id: "github-rising",
  name: "Rising GitHub repos",
  description: "The five most-starred GitHub repos created in the last week, with stars, language and description.",
  apis: ["GitHub"],
  category: "tech",
  dataCode: code,
  rows: rows("github-rising", wire),
  sampleVars: {"clock":"01:28","r1_col":"#DEA584","r1_desc":"Rust - Rewrite your whole app in Rust, o..","r1_dot":64,"r1_dx":42,"r1_name":"rust-anything","r1_nx":109,"r1_owner":"erkamyaman/","r1_rank":"1","r1_s0":39,"r1_s1":44,"r1_s2":45,"r1_s3":48,"r1_s4":51,"r1_s5":53,"r1_stars":"6.1k","r2_col":"#F34B7D","r2_desc":"C++ - Show the battery level of wireless..","r2_dot":105,"r2_dx":42,"r2_name":"Wireless-Device-Battery-Moni..","r2_nx":32,"r2_owner":"","r2_rank":"2","r2_s0":80,"r2_s1":85,"r2_s2":86,"r2_s3":89,"r2_s4":92,"r2_s5":94,"r2_stars":"5k","r3_col":"#3572A5","r3_desc":"Python - No description","r3_dot":146,"r3_dx":42,"r3_name":"google-ultra","r3_nx":76,"r3_owner":"gylive/","r3_rank":"3","r3_s0":121,"r3_s1":126,"r3_s2":127,"r3_s3":130,"r3_s4":133,"r3_s5":135,"r3_stars":"2.5k","r4_col":"#3572A5","r4_desc":"Python - No description","r4_dot":187,"r4_dx":42,"r4_name":"ung220z-tool","r4_nx":85,"r4_owner":"Hut-hzf/","r4_rank":"4","r4_s0":162,"r4_s1":167,"r4_s2":168,"r4_s3":171,"r4_s4":174,"r4_s5":176,"r4_stars":"1.9k","r5_col":"#F1E05A","r5_desc":"JavaScript - No description","r5_dot":228,"r5_dx":42,"r5_name":"mdldm-maitian","r5_nx":97,"r5_owner":"CzzzzzzJ/","r5_rank":"5","r5_s0":203,"r5_s1":208,"r5_s2":209,"r5_s3":212,"r5_s4":215,"r5_s5":217,"r5_stars":"1.7k","window_label":"NEW THIS WEEK"},
};

export default template;
