import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Cloud status board: six Statuspage-powered services in a 2x3 grid.

const TOP = 32; // y of the first tile row
const TILE_H = 64;
const GAP = 5;
const COL_X = [6, 163];
const TILE_W = 151;

const code = String.raw`// Six cloud services from their public Atlassian Statuspage feeds (keyless).
// Each tile is green when all is well, amber for minor issues and red for major or critical ones.
// Any Statuspage host works: https://<host>/api/v2/status.json
const SERVICES = [
  ["GitHub", "www.githubstatus.com"],
  ["Cloudflare", "www.cloudflarestatus.com"],
  ["OpenAI", "status.openai.com"],
  ["Claude", "status.claude.com"],
  ["Discord", "discordstatus.com"],
  ["Vercel", "www.vercel-status.com"],
]; // up to 6 [label, host] pairs; keep labels to about 10 letters

// indicator -> [bright colour, tile tint]
const LOOK = {
  none: ["#3ECF8E", "#0E2A1C"],
  minor: ["#FFB020", "#33250A"],
  major: ["#FF5A5F", "#3A1214"],
  critical: ["#FF3B6B", "#4A0E1C"],
  maintenance: ["#4DA3FF", "#0F2236"],
  unknown: ["#808080", "#1C1C1C"],
};

// Font 2 widths (char code - 32) for fitting the status line into the tile.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const width = (s) => { let w = 0; for (const ch of s) w += W2[ch.charCodeAt(0) - 32] || 7; return w; };
function fit(s, max) {
  if (width(s) <= max) return s;
  while (s.length > 1 && width(s + ".") > max) s = s.slice(0, -1);
  return s.trimEnd() + ".";
}

// Statuspage descriptions are long; shorten the common ones.
function shortDesc(d) {
  const s = String(d || "").replace(/[^\x20-\x7E]/g, "").trim();
  const map = {
    "All Systems Operational": "Operational",
    "Partially Degraded Service": "Degraded",
    "Minor Service Outage": "Minor outage",
    "Partial System Outage": "Partial outage",
    "Major Service Outage": "Major outage",
    "Service Under Maintenance": "Maintenance",
  };
  return map[s] || s.replace(/ (Service|System)s?\b/g, "") || "Unknown";
}

const tiles = [];
for (let i = 0; i < 6; i++) {
  const svc = SERVICES[i];
  if (!svc) { tiles.push(null); continue; }
  let ind = "unknown", desc = "No data";
  try {
    const r = await get("https://" + svc[1] + "/api/v2/status.json", { cache: 300 });
    if (r && r.status && typeof r.status.indicator === "string") {
      ind = LOOK[r.status.indicator] ? r.status.indicator : "unknown";
      desc = shortDesc(r.status.description);
    }
  } catch (e) {
    console.log("status-board: " + svc[1] + " " + e.message);
  }
  tiles.push({ name: String(svc[0]).replace(/[^\x20-\x7E]/g, ""), ind, desc });
}

let ok = 0, total = 0;
for (const t of tiles) if (t) { total++; if (t.ind === "none") ok++; }
const issues = tiles.filter((t) => t && t.ind !== "none" && t.ind !== "unknown").length;

export const time = now("HH:mm");
export const summary = total === 0 ? "No services" : issues === 0 && ok === total ? "All OK" : ok + "/" + total + " OK";
export const summary_col = issues === 0 ? (ok === total ? "#3ECF8E" : "#A0A0A0") : "#FFB020";

function out(i) {
  const t = tiles[i];
  if (!t) return { name: "", desc: "", fg: "#303030", bg: "#101010" }; // unused slot: a dim blank tile
  const look = LOOK[t.ind];
  return { name: fit(t.name, 120), desc: fit(t.desc, 124), fg: look[0], bg: look[1] };
}
const o = [0, 1, 2, 3, 4, 5].map(out);
export const s1_name = o[0].name, s1_desc = o[0].desc, s1_fg = o[0].fg, s1_bg = o[0].bg;
export const s2_name = o[1].name, s2_desc = o[1].desc, s2_fg = o[1].fg, s2_bg = o[1].bg;
export const s3_name = o[2].name, s3_desc = o[2].desc, s3_fg = o[2].fg, s3_bg = o[2].bg;
export const s4_name = o[3].name, s4_desc = o[3].desc, s4_fg = o[3].fg, s4_bg = o[3].bg;
export const s5_name = o[4].name, s5_desc = o[4].desc, s5_fg = o[4].fg, s5_bg = o[4].bg;
export const s6_name = o[5].name, s6_desc = o[5].desc, s6_fg = o[5].fg, s6_bg = o[5].bg;
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#16202C"],
  ["text", "CLOUD STATUS", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{summary}", 262, 13, 2, 1, "MR", "{summary_col}"],
  ["text", "{time}", 312, 13, 2, 1, "MR", "#A0A0A0"],
  ...[0, 1, 2, 3, 4, 5].flatMap((i): RawWireOp[] => {
    const n = i + 1;
    const x = COL_X[i % 2];
    const y = TOP + Math.floor(i / 2) * (TILE_H + GAP);
    return [
      ["fillRoundRect", x, y, TILE_W, TILE_H, 6, `{s${n}_bg}`],
      ["fillRoundRect", x, y, 6, TILE_H, 3, `{s${n}_fg}`],
      ["text", `{s${n}_name}`, x + 16, y + 22, 4, 1, "ML", "#FFFFFF"],
      ["fillCircle", x + 21, y + 47, 4, `{s${n}_fg}`],
      ["text", `{s${n}_desc}`, x + 31, y + 48, 2, 1, "ML", `{s${n}_fg}`],
    ];
  }),
];

const template: Template = {
  id: "status-board",
  name: "Cloud status board",
  description: "Live health of GitHub, Cloudflare, OpenAI, Claude, Discord and Vercel as green, amber or red tiles.",
  apis: ["Statuspage"],
  category: "tech",
  dataCode: code,
  rows: rows("status-board", wire),
  sampleVars: {"s1_bg":"#0E2A1C","s1_desc":"Operational","s1_fg":"#3ECF8E","s1_name":"GitHub","s2_bg":"#33250A","s2_desc":"Degraded","s2_fg":"#FFB020","s2_name":"Cloudflare","s3_bg":"#0E2A1C","s3_desc":"Operational","s3_fg":"#3ECF8E","s3_name":"OpenAI","s4_bg":"#0E2A1C","s4_desc":"Operational","s4_fg":"#3ECF8E","s4_name":"Claude","s5_bg":"#0E2A1C","s5_desc":"Operational","s5_fg":"#3ECF8E","s5_name":"Discord","s6_bg":"#0E2A1C","s6_desc":"Operational","s6_fg":"#3ECF8E","s6_name":"Vercel","summary":"5/6 OK","summary_col":"#FFB020","time":"14:30"},
};

export default template;
