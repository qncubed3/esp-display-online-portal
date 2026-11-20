import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// npm weekly downloads

const dataCode = String.raw`// Last-week downloads of five npm packages, as bars scaled to the largest.
// npm's downloads API is keyless. Its bulk form doesn't take scoped packages, so each one is fetched on its own.
const PACKAGES = ["react", "next", "vue", "svelte", "@angular/core"]; // up to 5 package names
const COLORS = ["#61DAFB", "#E6E6E6", "#41B883", "#FF5A1F", "#F0405A"]; // bar colour for each package, in order

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 275243399 -> "275M", 24123456 -> "24.1M", 8492071 -> "8.49M", 51234 -> "51.2k"
function compact(n) {
  const fmt = (v, s) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + s;
  if (n >= 1e9) return fmt(n / 1e9, "B");
  if (n >= 1e6) return fmt(n / 1e6, "M");
  if (n >= 1e3) return fmt(n / 1e3, "k");
  return String(n);
}

// "2026-11-13" -> "13 Nov"
function day(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? Number(m[3]) + " " + MON[Number(m[2]) - 1] : "";
}

const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, "");

const list = [];
let start = "", end = "";
for (let i = 0; i < 5; i++) {
  const pkg = PACKAGES[i];
  if (!pkg) continue;
  let n = null;
  try {
    const r = await get("https://api.npmjs.org/downloads/point/last-week/" + pkg, { cache: 21600 });
    if (r && typeof r.downloads === "number") {
      n = r.downloads;
      start = start || r.start;
      end = end || r.end;
    }
  } catch (e) {
    console.log("npm failed for", pkg, e.message);
  }
  list.push({ name: ascii(pkg), n: n, color: COLORS[i] || "#8B949E" });
}

// Biggest first; failed packages go last.
list.sort((a, b) => (b.n === null ? -1 : b.n) - (a.n === null ? -1 : a.n));
const max = Math.max(1, ...list.map((p) => p.n || 0));
const BAR = 300;

export const range = start && end ? day(start) + " - " + day(end) : "No data";

const p1 = list[0] || {}, p2 = list[1] || {}, p3 = list[2] || {}, p4 = list[3] || {}, p5 = list[4] || {};
const nm = (p) => (p.name ? (p.name.length > 26 ? p.name.slice(0, 25) + "." : p.name) : "");
const ct = (p) => (!p.name ? "" : p.n === null ? "--" : compact(p.n));
const bw = (p) => (p.n ? Math.max(3, Math.round((p.n / max) * BAR)) : 0);
const by = (p, y) => (p.n ? y : -200); // off-screen hides the bar
const ty = (p, y) => (p.name ? y : -200); // hides the track for an empty slot

export const n1 = nm(p1), c1 = ct(p1), w1 = bw(p1), y1 = by(p1, 58), t1 = ty(p1, 58), col1 = p1.color || "#8B949E";
export const n2 = nm(p2), c2 = ct(p2), w2 = bw(p2), y2 = by(p2, 98), t2 = ty(p2, 98), col2 = p2.color || "#8B949E";
export const n3 = nm(p3), c3 = ct(p3), w3 = bw(p3), y3 = by(p3, 138), t3 = ty(p3, 138), col3 = p3.color || "#8B949E";
export const n4 = nm(p4), c4 = ct(p4), w4 = bw(p4), y4 = by(p4, 178), t4 = ty(p4, 178), col4 = p4.color || "#8B949E";
export const n5 = nm(p5), c5 = ct(p5), w5 = bw(p5), y5 = by(p5, 218), t5 = ty(p5, 218), col5 = p5.color || "#8B949E";
`;

const GREY = "#8B949E";
const TRACK = "#1E242C";

const wire: RawWireOp[] = [
  ["fillScreen", "#0D1117"],
  ["fillRect", 0, 0, 320, 28, "#2A1215"],
  ["drawFastHLine", 0, 28, 320, "#CB3837"],
  ["text", "npm weekly downloads", 10, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{range}", 310, 14, 2, 1, "MR", GREY],

  ...[1, 2, 3, 4, 5].flatMap((i): RawWireOp[] => {
    const top = 36 + (i - 1) * 40;
    return [
      ["text", `{n${i}}`, 10, top, 2, 1, "TL", `{col${i}}`],
      ["text", `{c${i}}`, 310, top, 2, 1, "TR", "#FFFFFF"],
      ["fillRoundRect", 10, `{t${i}}`, 300, 12, 4, TRACK],
      ["fillRoundRect", 10, `{y${i}}`, `{w${i}}`, 12, 4, `{col${i}}`],
    ];
  }),
];

const template: Template = {
  id: "npm-downloads",
  name: "npm downloads",
  description: "Last week's npm downloads for five packages as colour bars scaled to the largest.",
  apis: ["npm"],
  category: "tech",
  dataCode,
  rows: rows("npm-downloads", wire),
  sampleVars: {"c1":"275M","c2":"99.2M","c3":"26.6M","c4":"10.4M","c5":"8.49M","col1":"#61DAFB","col2":"#E6E6E6","col3":"#41B883","col4":"#FF5A1F","col5":"#F0405A","n1":"react","n2":"next","n3":"vue","n4":"svelte","n5":"@angular/core","range":"13 Nov - 19 Nov","t1":58,"t2":98,"t3":138,"t4":178,"t5":218,"w1":300,"w2":108,"w3":29,"w4":11,"w5":9,"y1":58,"y2":98,"y3":138,"y4":178,"y5":218},
};

export default template;
