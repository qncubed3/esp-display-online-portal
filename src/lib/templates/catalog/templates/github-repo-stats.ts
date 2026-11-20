import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// GitHub repo stats

const dataCode = String.raw`// Stars, forks, issues, watchers, language, last push and latest release of one GitHub repo.
// GitHub's API is free without a key but allows 60 requests an hour per server, so keep cache >= 1800 s.
const REPO = "vercel/next.js"; // change to any public "owner/repo"

const LANG_COLS = {
  JavaScript: "#F1E05A", TypeScript: "#3178C6", Python: "#3572A5", Go: "#00ADD8", Rust: "#DEA584",
  Java: "#B07219", "C++": "#F34B7D", C: "#8E8E8E", "C#": "#178600", Ruby: "#CC342D", PHP: "#4F5D95",
  Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89E051", HTML: "#E34C26",
  CSS: "#663399", Vue: "#41B883", Lua: "#5A6FD8", "Jupyter Notebook": "#DA5B0B",
};

// 143625 -> "143.6k", 1234567 -> "1.2M"
function compact(n) {
  if (typeof n !== "number") return "--";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ago(iso) {
  const t = Date.parse(iso);
  if (!t) return "--";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return min + "m ago";
  if (min < 48 * 60) return Math.round(min / 60) + "h ago";
  return Math.round(min / 1440) + "d ago";
}

const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, "");

let repo = null;
try {
  repo = await get("https://api.github.com/repos/" + REPO, { cache: 1800 });
} catch (e) {
  console.log("repo failed:", e.message);
}
let tag = "";
try {
  const rel = await get("https://api.github.com/repos/" + REPO + "/releases/latest", { cache: 3600 });
  tag = rel && rel.tag_name ? ascii(rel.tag_name).slice(0, 12) : "";
} catch (e) {
  // 404 when the repo has no releases; the tag is just left off.
}

const ok = repo && typeof repo === "object" && typeof repo.stargazers_count === "number";
const lang = ok && repo.language ? repo.language : "";
const name = ascii(ok ? repo.full_name : REPO);

export const repo_name = name.length > 22 ? name.slice(0, 21) + "." : name;
export const release = tag;
export const stars = ok ? compact(repo.stargazers_count) : "--";
export const stars_label = ok ? "STARS" : "GITHUB UNAVAILABLE";
export const forks = ok ? compact(repo.forks_count) : "--";
// GitHub counts open pull requests in open_issues_count.
export const issues = ok ? compact(repo.open_issues_count) : "--";
export const watchers = ok ? compact(repo.subscribers_count) : "--";
export const language = lang === "Jupyter Notebook" ? "Jupyter" : ascii(lang || (ok ? "None" : "--")).slice(0, 11);
export const lang_col = LANG_COLS[lang] || "#8B949E";
export const lang_y = lang ? 220 : -200; // off-screen hides the dot
export const pushed = ok ? ago(repo.pushed_at) : "--";
`;

// Five-pointed star: centre, outer and inner radius -> 8 triangles (5 tips + inner pentagon).
function star(cx: number, cy: number, R: number, r: number, col: string): RawWireOp[] {
  const pt = (i: number, rad: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [Math.round(cx + rad * Math.cos(a)), Math.round(cy + rad * Math.sin(a))] as const;
  };
  const outer = [0, 2, 4, 6, 8].map((i) => pt(i, R));
  const inner = [1, 3, 5, 7, 9].map((i) => pt(i, r));
  const ops: RawWireOp[] = [];
  for (let k = 0; k < 5; k++) {
    const a = inner[(k + 4) % 5], b = outer[k], c = inner[k];
    ops.push(["fillTriangle", a[0], a[1], b[0], b[1], c[0], c[1], col]);
  }
  for (const k of [1, 2, 3]) {
    ops.push(["fillTriangle", inner[0][0], inner[0][1], inner[k][0], inner[k][1], inner[k + 1][0], inner[k + 1][1], col]);
  }
  return ops;
}

const GREY = "#8B949E";
const CARD = "#161B22";

const wire: RawWireOp[] = [
  ["fillScreen", "#0D1117"],
  ["fillRect", 0, 0, 320, 30, CARD],
  ["drawFastHLine", 0, 30, 320, "#30363D"],
  ["text", "{repo_name}", 10, 15, 2, 1, "ML", "#FFFFFF"],
  ["text", "{release}", 310, 15, 2, 1, "MR", "#3FB950"],

  ...star(44, 76, 28, 12, "#E3B341"),
  ["text", "{stars}", 86, 70, 4, 2, "ML", "#FFFFFF"],
  ["text", "{stars_label}", 88, 100, 2, 1, "TL", GREY],

  ...([
    [8, "{forks}", "FORKS"],
    [112, "{issues}", "OPEN ISSUES"],
    [216, "{watchers}", "WATCHERS"],
  ] as const).flatMap(([x, value, label]): RawWireOp[] => [
    ["fillRoundRect", x, 124, 96, 58, 6, CARD],
    ["text", value, x + 48, 132, 4, 1, "TC", "#FFFFFF"],
    ["text", label, x + 48, 162, 2, 1, "TC", GREY],
  ]),

  ["text", "LANGUAGE", 10, 192, 2, 1, "TL", GREY],
  ["fillCircle", 17, "{lang_y}", 6, "{lang_col}"],
  ["text", "{language}", 30, 208, 4, 1, "TL", "#FFFFFF"],
  ["text", "LAST PUSH", 310, 192, 2, 1, "TR", GREY],
  ["text", "{pushed}", 310, 208, 4, 1, "TR", "#FFFFFF"],
];

const template: Template = {
  id: "github-repo-stats",
  name: "GitHub repo stats",
  description: "Stars, forks, open issues, watchers, language, last push and latest release of one GitHub repo.",
  apis: ["GitHub"],
  category: "tech",
  dataCode,
  rows: rows("github-repo-stats", wire),
  sampleVars: {"forks": "32.8k", "issues": "4,085", "lang_col": "#F1E05A", "lang_y": 220, "language": "JavaScript", "pushed": "4m ago", "release": "v16.4.6", "repo_name": "vercel/next.js", "stars": "143.6k", "stars_label": "STARS", "watchers": "1,628"},
};

export default template;
