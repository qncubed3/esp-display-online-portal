import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// People in space right now, grouped by station

const SLOTS = 12; // list lines on the right
const SLOT_Y0 = 33; // top of the first line
const SLOT_H = 17; // line spacing

const dataCode = String.raw`// How many people are in space right now, and who, grouped by station.
// Main source: corquaid's community-maintained list (kept current). Fallback: Open Notify
// (its list is often months out of date, so it is only used when the first one fails).
const PRIMARY = "https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json";
const FALLBACK = "http://api.open-notify.org/astros.json";
const SLOTS = 12; // lines in the list on the right
const NAME_PX = 192; // room for a name, in font 2 pixels
const HIDE = -200; // y for a divider line that should not show
const COLORS = { ISS: "#5AC8FA", Tiangong: "#FF6F61" };
const OTHER_COLOR = "#FFD24A";

// Font 2 glyph widths (chars 32-126), to cut names to the space they have.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const w2 = (s) => [...s].reduce((n, ch) => n + (W2[ch.charCodeAt(0) - 32] || 8), 0);
function ascii(s) {
  let t = String(s || "");
  try { t = t.normalize("NFD"); } catch (e) {}
  return t.replace(/[̀-ͯ]/g, "").replace(/[‐-―]/g, "-").replace(/[‘’]/g, "'").replace(/[^\x20-\x7e]/g, "").trim();
}
function fit(s, px) {
  if (w2(s) <= px) return s;
  while (s.length && w2(s + "..") > px) s = s.slice(0, -1);
  return s.trimEnd() + "..";
}

// people: [{ name, station }]
let people = null;
try {
  const d = await get(PRIMARY, { cache: 3600 });
  if (d && Array.isArray(d.people) && d.people.length) {
    people = d.people.map((p) => ({
      name: p.name,
      station: p.iss ? "ISS" : p.agency === "CMSA" || /^Shenzhou/i.test(p.spacecraft || "") ? "Tiangong" : ascii(p.spacecraft) || "Other",
    }));
  }
} catch (e) {
  console.log("corquaid failed:", e.message);
}
if (!people) {
  try {
    const d = await get(FALLBACK, { cache: 3600 });
    if (d && Array.isArray(d.people) && d.people.length) people = d.people.map((p) => ({ name: p.name, station: ascii(p.craft) || "Other" }));
  } catch (e) {
    console.log("Open Notify failed:", e.message);
  }
}

// Group by station: ISS first, then Tiangong, then anything else in order of appearance.
const groups = [];
for (const p of people || []) {
  let g = groups.find((x) => x.station === p.station);
  if (!g) groups.push((g = { station: p.station, names: [] }));
  g.names.push(ascii(p.name) || "Unknown");
}
const rank = (s) => (s === "ISS" ? 0 : s === "Tiangong" ? 1 : 2);
groups.sort((a, b) => rank(a.station) - rank(b.station));

// Lines for the list: a header per station, then its names.
let lines = [];
for (const g of groups) {
  const col = COLORS[g.station] || OTHER_COLOR;
  lines.push({ head: true, text: fit(g.station.toUpperCase(), 150), n: String(g.names.length), col });
  for (const n of g.names) lines.push({ head: false, text: fit(n, NAME_PX), n: "", col: "#FFFFFF" });
}
if (lines.length > SLOTS) {
  const shown = lines.slice(0, SLOTS - 1);
  const hidden = (people ? people.length : 0) - shown.filter((l) => !l.head).length;
  lines = shown.concat([{ head: false, text: "+" + hidden + " more", n: "", col: "#9AA3B2" }]);
}
if (!people) lines = [{ head: false, text: "Crew list unavailable", n: "", col: "#9AA3B2" }];

function slot(i) {
  const l = lines[i];
  if (!l) return { t: "", n: "", c: "#FFFFFF", x: 112, ly: HIDE };
  return { t: l.text, n: l.n, c: l.col, x: l.head ? 112 : 120, ly: l.head ? 33 + i * 17 + 15 : HIDE };
}
const s = [];
for (let i = 0; i < SLOTS; i++) s.push(slot(i));
export const s1 = s[0].t, s1_n = s[0].n, s1_c = s[0].c, s1_x = s[0].x, s1_ly = s[0].ly;
export const s2 = s[1].t, s2_n = s[1].n, s2_c = s[1].c, s2_x = s[1].x, s2_ly = s[1].ly;
export const s3 = s[2].t, s3_n = s[2].n, s3_c = s[2].c, s3_x = s[2].x, s3_ly = s[2].ly;
export const s4 = s[3].t, s4_n = s[3].n, s4_c = s[3].c, s4_x = s[3].x, s4_ly = s[3].ly;
export const s5 = s[4].t, s5_n = s[4].n, s5_c = s[4].c, s5_x = s[4].x, s5_ly = s[4].ly;
export const s6 = s[5].t, s6_n = s[5].n, s6_c = s[5].c, s6_x = s[5].x, s6_ly = s[5].ly;
export const s7 = s[6].t, s7_n = s[6].n, s7_c = s[6].c, s7_x = s[6].x, s7_ly = s[6].ly;
export const s8 = s[7].t, s8_n = s[7].n, s8_c = s[7].c, s8_x = s[7].x, s8_ly = s[7].ly;
export const s9 = s[8].t, s9_n = s[8].n, s9_c = s[8].c, s9_x = s[8].x, s9_ly = s[8].ly;
export const s10 = s[9].t, s10_n = s[9].n, s10_c = s[9].c, s10_x = s[9].x, s10_ly = s[9].ly;
export const s11 = s[10].t, s11_n = s[10].n, s11_c = s[10].c, s11_x = s[10].x, s11_ly = s[10].ly;
export const s12 = s[11].t, s12_n = s[11].n, s12_c = s[11].c, s12_x = s[11].x, s12_ly = s[11].ly;

export const count = people ? String(people.length) : "--";
export const stations = groups.length ? groups.length + (groups.length === 1 ? " station" : " stations") : "";
export const clock = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#1A1F2E"],
  ["text", "PEOPLE IN SPACE", 8, 13, 2, 1, "ML", "#FFB000"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#9AA3B2"],
  // Left panel: the big count
  ["fillRoundRect", 6, 32, 96, 202, 8, "#141A2E"],
  ["text", "{count}", 54, 102, 4, 3, "MC", "#FFFFFF"],
  ["text", "HUMANS", 54, 160, 2, 1, "MC", "#9AA3B2"],
  ["text", "IN ORBIT", 54, 178, 2, 1, "MC", "#9AA3B2"],
  ["text", "{stations}", 54, 214, 1, 1, "MC", "#6B7385"],
  // Right: station headers (with count and divider) and names
  ...Array.from({ length: SLOTS }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = SLOT_Y0 + i * SLOT_H;
    return [
      ["drawFastHLine", 112, `{s${n}_ly}`, 202, `{s${n}_c}`],
      ["text", `{s${n}}`, `{s${n}_x}`, y, 2, 1, "TL", `{s${n}_c}`],
      ["text", `{s${n}_n}`, 314, y, 2, 1, "TR", `{s${n}_c}`],
    ];
  }).flat(),
];

const template: Template = {
  id: "people-in-space",
  name: "People in space",
  description: "How many people are in space right now, with their names grouped by station (ISS, Tiangong).",
  apis: ["corquaid ISS API", "Open Notify"],
  category: "space",
  dataCode,
  rows: rows("people-in-space", wire),
  sampleVars: {"clock":"01:02","count":"10","s1":"ISS","s10":"Zhu Yangzhu","s10_c":"#FFFFFF","s10_ly":-200,"s10_n":"","s10_x":120,"s11":"Zhang Zhiyuan","s11_c":"#FFFFFF","s11_ly":-200,"s11_n":"","s11_x":120,"s12":"Lai Ka-ying","s12_c":"#FFFFFF","s12_ly":-200,"s12_n":"","s12_x":120,"s1_c":"#5AC8FA","s1_ly":48,"s1_n":"7","s1_x":112,"s2":"Pyotr Dubrov","s2_c":"#FFFFFF","s2_ly":-200,"s2_n":"","s2_x":120,"s3":"Anna Kikina","s3_c":"#FFFFFF","s3_ly":-200,"s3_n":"","s3_x":120,"s4":"Anil Menon","s4_c":"#FFFFFF","s4_ly":-200,"s4_n":"","s4_x":120,"s5":"Jessica Watkins","s5_c":"#FFFFFF","s5_ly":-200,"s5_n":"","s5_x":120,"s6":"Luke Delaney","s6_c":"#FFFFFF","s6_ly":-200,"s6_n":"","s6_x":120,"s7":"Joshua Kutryk","s7_c":"#FFFFFF","s7_ly":-200,"s7_n":"","s7_x":120,"s8":"Sergey Teteryatnikov","s8_c":"#FFFFFF","s8_ly":-200,"s8_n":"","s8_x":120,"s9":"TIANGONG","s9_c":"#FF6F61","s9_ly":184,"s9_n":"3","s9_x":112,"stations":"2 stations"},
};

export default template;
