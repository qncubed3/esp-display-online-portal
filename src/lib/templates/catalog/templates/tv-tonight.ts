import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Tonight's free-to-air prime time in Australia: one row per show (time, channel badge, show name).

const TOP = 30; // y of the first row
const ROW_H = 26; // 8 rows fill 30..238
const N = 8;

const code = String.raw`// Tonight's Australian TV prime time from TVmaze (api.tvmaze.com, free, no key).
// Lists shows starting FROM..TO (east-coast times) that haven't finished yet.
// If tonight's list is short or over, it fills the rest with tomorrow night.
const FROM = "17:30", TO = "23:00"; // prime-time window
const ROWS = 8;
const ON_NOW = "#FFC400", LATER = "#9EC9FF", NAME = "#FFFFFF", DIM = "#8A8A8A", ACCENT = "#4FC3F7";

// Channel badge: label, background, label colour. Matched on network or streaming channel name.
function badge(name) {
  const n = String(name || "");
  if (/^ABC/i.test(n)) return ["ABC", "#00897B", "#FFFFFF"];
  if (/^SBS/i.test(n)) return ["SBS", "#E0A800", "#000000"];
  if (/^NITV/i.test(n)) return ["NITV", "#B5651D", "#FFFFFF"];
  if (n === "Seven Network") return ["7", "#D32F2F", "#FFFFFF"];
  if (n === "Nine Network") return ["9", "#1E63C8", "#FFFFFF"];
  if (n === "Network 10") return ["10", "#7B1FA2", "#FFFFFF"];
  const c = n.replace(/[^A-Za-z0-9]/g, "").slice(0, 5);
  if (/^7/.test(c)) return [c, "#D32F2F", "#FFFFFF"];
  if (/^9/.test(c)) return [c, "#1E63C8", "#FFFFFF"];
  if (/^10/.test(c)) return [c.slice(0, 4), "#7B1FA2", "#FFFFFF"];
  return [c || "TV", "#555555", "#FFFFFF"];
}
const ORDER = { ABC: 0, SBS: 1, NITV: 2 };
function rank(label) { return label in ORDER ? ORDER[label] : /^7/.test(label) ? 3 : /^9/.test(label) ? 4 : /^10/.test(label) ? 5 : 6; }

// Font 2 glyph widths for chars 32..126, to cut names to the space available.
const W = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => { let w = 0; for (const ch of s) w += W[ch.charCodeAt(0) - 32] || 0; return w; };
function fit(s, max) {
  if (width(s) <= max) return s;
  while (s.length > 1 && width(s + "..") > max) s = s.slice(0, -1);
  return s.trim() + "..";
}
function ascii(s) {
  return String(s || "")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/&amp;/g, "&")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
}
const mins = (hm) => { const p = String(hm).split(":"); return Number(p[0]) * 60 + Number(p[1]); };

async function schedule(date) {
  try {
    const d = await get("https://api.tvmaze.com/schedule?country=AU&date=" + date, { cache: 3600 });
    return Array.isArray(d) ? d : [];
  } catch (e) {
    console.log("tv-tonight: " + e.message);
    return null;
  }
}

// Shows in the window that end after "after" (minutes), sorted by time then channel.
function pick(list, after) {
  const seen = {};
  const out = [];
  for (const e of list || []) {
    const t = String(e.airtime || "");
    if (!/^\d\d:\d\d$/.test(t) || t < FROM || t >= TO || !e.show) continue;
    const start = mins(t);
    if (start + (e.runtime || 30) <= after) continue;
    const name = ascii(e.show.name);
    if (!name || seen[t + name]) continue;
    seen[t + name] = 1;
    const ch = (e.show.network && e.show.network.name) || (e.show.webChannel && e.show.webChannel.name);
    const b = badge(ch);
    out.push({ t, start, end: start + (e.runtime || 30), name, b });
  }
  return out.sort((a, b) => a.start - b.start || rank(a.b[0]) - rank(b.b[0]));
}

const p = now("YYYY MM DD HH mm").split(" ").map(Number);
const nowMin = p[3] * 60 + p[4];
const ymd = (d) => d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
const today = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
const tomorrow = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1));
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const tonightList = await schedule(ymd(today));
const tonight = pick(tonightList, nowMin);
const items = tonight.map((s) => ({ ...s, on: s.start <= nowMin && nowMin < s.end }));
let failed = tonightList === null;
if (items.length < ROWS - 1) {
  const next = pick(await schedule(ymd(tomorrow)), 0);
  if (next.length) {
    items.push({ sep: items.length ? "Tomorrow, " + DAYS[tomorrow.getUTCDay()] : "" });
    if (!items[items.length - 1].sep) items.pop();
    for (const s of next) items.push({ ...s, on: false });
    failed = false;
  }
}
const showsTomorrow = !tonight.length && items.length > 0;

// Badge y matches Draw: rows start at y 30, 26 px apart; -200 hides the badge.
function row(i) {
  const s = items[i];
  if (!s) {
    const msg = i === 0 ? (failed ? "No data" : "No shows listed") : "";
    return { t: "", n: msg, nc: DIM, tc: LATER, b: "", by: -200, bb: "#555555", bf: "#FFFFFF" };
  }
  if (s.sep !== undefined) return { t: "", n: s.sep, nc: ACCENT, tc: LATER, b: "", by: -200, bb: "#555555", bf: "#FFFFFF" };
  return { t: s.t, n: fit(s.name, 214), nc: NAME, tc: s.on ? ON_NOW : LATER, b: s.b[0], by: 33 + i * 26, bb: s.b[1], bf: s.b[2] };
}
const R = [0, 1, 2, 3, 4, 5, 6, 7].map(row);
export const r1_t = R[0].t, r1_n = R[0].n, r1_nc = R[0].nc, r1_tc = R[0].tc, r1_b = R[0].b, r1_by = R[0].by, r1_bb = R[0].bb, r1_bf = R[0].bf;
export const r2_t = R[1].t, r2_n = R[1].n, r2_nc = R[1].nc, r2_tc = R[1].tc, r2_b = R[1].b, r2_by = R[1].by, r2_bb = R[1].bb, r2_bf = R[1].bf;
export const r3_t = R[2].t, r3_n = R[2].n, r3_nc = R[2].nc, r3_tc = R[2].tc, r3_b = R[2].b, r3_by = R[2].by, r3_bb = R[2].bb, r3_bf = R[2].bf;
export const r4_t = R[3].t, r4_n = R[3].n, r4_nc = R[3].nc, r4_tc = R[3].tc, r4_b = R[3].b, r4_by = R[3].by, r4_bb = R[3].bb, r4_bf = R[3].bf;
export const r5_t = R[4].t, r5_n = R[4].n, r5_nc = R[4].nc, r5_tc = R[4].tc, r5_b = R[4].b, r5_by = R[4].by, r5_bb = R[4].bb, r5_bf = R[4].bf;
export const r6_t = R[5].t, r6_n = R[5].n, r6_nc = R[5].nc, r6_tc = R[5].tc, r6_b = R[5].b, r6_by = R[5].by, r6_bb = R[5].bb, r6_bf = R[5].bf;
export const r7_t = R[6].t, r7_n = R[6].n, r7_nc = R[6].nc, r7_tc = R[6].tc, r7_b = R[6].b, r7_by = R[6].by, r7_bb = R[6].bb, r7_bf = R[6].bf;
export const r8_t = R[7].t, r8_n = R[7].n, r8_nc = R[7].nc, r8_tc = R[7].tc, r8_b = R[7].b, r8_by = R[7].by, r8_bb = R[7].bb, r8_bf = R[7].bf;

export const title = showsTomorrow ? "TV tomorrow" : "TV tonight";
export const day = showsTomorrow ? DAYS[tomorrow.getUTCDay()] + " " + tomorrow.getUTCDate() : now("ddd DD").replace(/ 0/, " ");
export const clock = now("HH:mm");
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#2A1440"],
  ["text", "{title}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{day}", 160, 13, 2, 1, "MC", "#C9A0FF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#D0D0D0"],
  ...Array.from({ length: N }, (_, i): RawWireOp[] => {
    const n = i + 1;
    const y = TOP + i * ROW_H;
    const mid = y + ROW_H / 2 - 1;
    return [
      ...(i % 2 === 1 ? ([["fillRect", 0, y - 1, 320, ROW_H, "#111118"]] as RawWireOp[]) : []),
      ["text", `{r${n}_t}`, 8, mid, 2, 1, "ML", `{r${n}_tc}`],
      ["fillRoundRect", 50, `{r${n}_by}`, 42, 18, 4, `{r${n}_bb}`],
      ["text", `{r${n}_b}`, 71, mid, 2, 1, "MC", `{r${n}_bf}`],
      ["text", `{r${n}_n}`, 100, mid, 2, 1, "ML", `{r${n}_nc}`],
    ];
  }).flat(),
];

const template: Template = {
  id: "tv-tonight",
  name: "TV tonight",
  description: "Tonight's Australian free-to-air prime time: start time, channel and show, with what's on now highlighted.",
  apis: ["TVmaze"],
  category: "fun",
  dataCode: code,
  rows: rows("tv-tonight", wire),
  sampleVars: {
    clock: "01:25",
    day: "Sat 21",
    r1_b: "9",
    r1_bb: "#1E63C8",
    r1_bf: "#FFFFFF",
    r1_by: 33,
    r1_n: "A Current Affair",
    r1_nc: "#FFFFFF",
    r1_t: "19:00",
    r1_tc: "#9EC9FF",
    r2_b: "ABC",
    r2_bb: "#00897B",
    r2_bf: "#FFFFFF",
    r2_by: 59,
    r2_n: "Hard Quiz Kids",
    r2_nc: "#FFFFFF",
    r2_t: "19:30",
    r2_tc: "#9EC9FF",
    r3_b: "",
    r3_bb: "#555555",
    r3_bf: "#FFFFFF",
    r3_by: -200,
    r3_n: "Tomorrow, Sun",
    r3_nc: "#4FC3F7",
    r3_t: "",
    r3_tc: "#9EC9FF",
    r4_b: "10",
    r4_bb: "#7B1FA2",
    r4_bf: "#FFFFFF",
    r4_by: 111,
    r4_n: "10 NEWS+",
    r4_nc: "#FFFFFF",
    r4_t: "18:30",
    r4_tc: "#9EC9FF",
    r5_b: "10",
    r5_bb: "#7B1FA2",
    r5_bf: "#FFFFFF",
    r5_by: 137,
    r5_n: "Big Brother",
    r5_nc: "#FFFFFF",
    r5_t: "19:00",
    r5_tc: "#9EC9FF",
    r6_b: "ABC",
    r6_bb: "#00897B",
    r6_bf: "#FFFFFF",
    r6_by: 163,
    r6_n: "Recipe of the Year",
    r6_nc: "#FFFFFF",
    r6_t: "19:30",
    r6_tc: "#9EC9FF",
    r7_b: "9",
    r7_bb: "#1E63C8",
    r7_bf: "#FFFFFF",
    r7_by: 189,
    r7_n: "60 Minutes",
    r7_nc: "#FFFFFF",
    r7_t: "20:40",
    r7_tc: "#9EC9FF",
    r8_b: "9",
    r8_bb: "#1E63C8",
    r8_bf: "#FFFFFF",
    r8_by: 215,
    r8_n: "9News Late",
    r8_nc: "#FFFFFF",
    r8_t: "22:30",
    r8_tc: "#9EC9FF",
    title: "TV tonight",
  },
};

export default template;
