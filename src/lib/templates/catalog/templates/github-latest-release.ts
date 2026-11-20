import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Release watcher

const dataCode = String.raw`// Latest release of one GitHub repo: tag, release name, age, date and asset downloads.
// GitHub's API is free without a key but allows 60 requests an hour per server, so keep cache >= 1800 s.
const REPO = "espressif/arduino-esp32"; // change to any public "owner/repo" that publishes releases
const NEW_DAYS = 7; // show the green NEW badge while the release is younger than this

// Glyph widths (px) of font 2 and font 4, indexed by char code - 32, for exact wrapping and fitting.
const F2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const F4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15,1];
const width = (s, w) => { let n = 0; for (const c of s) n += w[c.charCodeAt(0) - 32] || 0; return n; };

const ascii = (s) =>
  String(s || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();

// Cut s to fit maxW px, ending in "..." when cut.
function fit(s, w, maxW) {
  if (width(s, w) <= maxW) return s;
  while (s && width(s + "...", w) > maxW) s = s.slice(0, -1);
  return s.trimEnd() + "...";
}

// 199572 -> "199.6k"
function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ago(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return min + "m";
  if (min < 48 * 60) return Math.round(min / 60) + "h";
  if (min < 60 * 24 * 60) return Math.round(min / 1440) + "d";
  if (min < 730 * 24 * 60) return Math.round(min / 43200) + "mo";
  return Math.round(min / 525600) + "y";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let rel = null;
try {
  rel = await get("https://api.github.com/repos/" + REPO + "/releases/latest", { cache: 3600 });
} catch (e) {
  console.log("release failed:", e.message); // 404 when the repo has no releases
}
const ok = rel && typeof rel === "object" && typeof rel.tag_name === "string";

// Tag: font 4 at size 2 if it fits beside the badge, else size 1.
const tagRaw = ok ? ascii(rel.tag_name) : "--";
const big = width(tagRaw, F4) * 2 <= 220;
const tag = big ? tagRaw : fit(tagRaw, F4, 300);
const tagW = width(tag, F4) * (big ? 2 : 1);

// Release name wrapped onto two font-2 lines of 300 px.
const title = ok ? ascii(rel.name) || tagRaw : "No release found for this repo";
const words = title.split(/\s+/).filter(Boolean);
let n1 = "";
let i = 0;
for (; i < words.length; i++) {
  const next = n1 ? n1 + " " + words[i] : words[i];
  if (n1 && width(next, F2) > 300) break;
  n1 = next;
}
n1 = fit(n1, F2, 300);
const n2 = fit(words.slice(i).join(" "), F2, 300);

const pub = ok ? Date.parse(rel.published_at || rel.created_at) : NaN;
const age = Date.now() - pub;
const isNew = ok && age >= 0 && age < NEW_DAYS * 86400000;
const d = new Date(pub);
const assets = ok && Array.isArray(rel.assets) ? rel.assets : [];
const dl = assets.reduce((s, a) => s + (a.download_count || 0), 0);

export const repo = fit(ascii(REPO), F2, 240);
export const clock = now("HH:mm");
export const tag_text = tag;
export const tag_size = big ? 2 : 1;
export const by = ok && rel.author && rel.author.login ? fit("by " + ascii(rel.author.login), F2, 150) : "";
export const name1 = n1;
export const name2 = n2;
export const badge_x = isNew ? Math.min(250, 10 + tagW + 12) : 0;
export const badge_y = isNew ? (big ? 72 : 60) : -200; // off-screen hides the badge
export const badge = isNew ? "NEW" : "";
export const badge_tx = badge_x + 26;
export const badge_ty = badge_y + 12;
export const published = isFinite(pub) ? ago(age) : "--";
export const date = isFinite(pub) ? d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] : "--";
export const downloads = ok ? (assets.length ? compact(dl) : "none") : "--";
`;

const GREY = "#8B949E";
const CARD = "#161B22";
const GREEN = "#3FB950";

const wire: RawWireOp[] = [
  ["fillScreen", "#0D1117"],
  ["fillRect", 0, 0, 320, 30, CARD],
  ["drawFastHLine", 0, 30, 320, "#30363D"],
  ["text", "{repo}", 10, 15, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 310, 15, 2, 1, "MR", GREY],

  ["text", "LATEST RELEASE", 10, 40, 2, 1, "TL", GREY],
  ["text", "{by}", 310, 40, 2, 1, "TR", GREY],
  ["text", "{tag_text}", 10, 60, 4, "{tag_size}", "TL", GREEN],
  ["fillRoundRect", "{badge_x}", "{badge_y}", 52, 24, 5, "#238636"],
  ["text", "{badge}", "{badge_tx}", "{badge_ty}", 2, 1, "MC", "#FFFFFF"],

  ["text", "{name1}", 10, 120, 2, 1, "TL", "#FFFFFF"],
  ["text", "{name2}", 10, 140, 2, 1, "TL", "#FFFFFF"],

  ...([
    [8, "{published}", "AGE"],
    [112, "{date}", "RELEASED"],
    [216, "{downloads}", "DOWNLOADS"],
  ] as const).flatMap(([x, value, label]): RawWireOp[] => [
    ["fillRoundRect", x, 168, 96, 62, 6, CARD],
    ["text", label, x + 48, 176, 2, 1, "TC", GREY],
    ["text", value, x + 48, 196, 4, 1, "TC", "#FFFFFF"],
  ]),
];

const template: Template = {
  id: "github-latest-release",
  name: "Release watcher",
  description: "Latest release of a GitHub repo: big tag, release name, age, date and downloads, with a NEW badge for a week.",
  apis: ["GitHub"],
  category: "tech",
  dataCode,
  rows: rows("github-latest-release", wire),
  sampleVars: {"badge": "NEW", "badge_tx": 160, "badge_ty": 84, "badge_x": 134, "badge_y": 72, "by": "by lucasssvaz", "clock": "09:41", "date": "19 Nov", "downloads": "199.6k", "name1": "ESP32 Arduino Release 4.0.0 based on", "name2": "ESP-IDF v6.1.1", "published": "37h", "repo": "espressif/arduino-esp32", "tag_size": 2, "tag_text": "4.0.0"},
};

export default template;
