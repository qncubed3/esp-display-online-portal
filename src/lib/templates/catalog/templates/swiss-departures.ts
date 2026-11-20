import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// A Swiss-style blue departure board for any station in Switzerland (transport.opendata.ch).

const code = String.raw`// Next six departures from a Swiss station, in the style of an SBB board.
// Data from transport.opendata.ch (free, no key, about 3 requests/s).
// Change STATION to any Swiss stop name, e.g. "Bern", "Luzern", "Geneve", "Basel SBB".
const STATION = "Zurich HB";
const ROWS = 6;

const FIELDS = ["station/name", "stationboard/category", "stationboard/number", "stationboard/to",
  "stationboard/stop/departure", "stationboard/stop/departureTimestamp", "stationboard/stop/delay",
  "stationboard/stop/platform", "stationboard/stop/prognosis/platform"];
const url = "https://transport.opendata.ch/v1/stationboard?station=" + encodeURIComponent(STATION) +
  "&limit=" + ROWS + FIELDS.map((f) => "&fields[]=" + f).join("");

let board = null;
try {
  board = await get(url, { cache: 60 });
} catch (e) {
  console.log("swiss-departures: " + e);
}

// Fonts are ASCII only: Zurich, Geneve, Neuchatel.
const MAP = { "ä": "a", "ö": "o", "ü": "u", "Ä": "A", "Ö": "O", "Ü": "U", "ß": "ss" };
function ascii(s) {
  s = String(s || "").replace(/[äöüÄÖÜß]/g, (c) => MAP[c]);
  try { s = s.normalize("NFD"); } catch (e) {}
  return s.replace(/[^\x20-\x7E]/g, "");
}

// Font 2 widths (chars 32-126), to fit names into their columns.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
function w2(s) {
  let w = 0;
  for (const ch of s) w += W2[ch.charCodeAt(0) - 32] || 8;
  return w;
}
function fit2(s, max) {
  if (w2(s) <= max) return s;
  while (s.length > 1 && w2(s + ".") > max) s = s.slice(0, -1);
  return s.trim() + ".";
}

const deps = board && Array.isArray(board.stationboard) ? board.stationboard.slice(0, ROWS) : [];
const name = ascii((board && board.station && board.station.name) || STATION).toUpperCase();
export const station = fit2(name, 200);

// Swiss local time: take the UTC offset from a departure ("...+0100") and apply it to now.
let offMin = 60;
const off = deps.length ? /([+-])(\d\d):?(\d\d)$/.exec(String(deps[0].stop.departure || "")) : null;
if (off) offMin = (off[1] === "-" ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3]));
export const clock = new Date(Date.now() + offMin * 60000).toISOString().slice(11, 16);

const LONG = ["IC", "ICE", "EC", "EN", "IR", "RE", "TGV", "RJX", "NJ", "PE", "EXT"];
const BADGE_W = 40;
const HIDE = -200;

function row(i) {
  const d = deps[i];
  const y = 48 + i * 31;
  if (!d) return { time: "", late: "", line: "", lineCol: "#FFFFFF", badge: "#FFFFFF", by: HIDE, dest: "", plat: "", platCol: "#FFFFFF", sep: HIDE };
  const s = d.stop || {};
  const cat = ascii(d.category || "");
  const num = ascii(d.number || "");
  const long = LONG.indexOf(cat) >= 0;
  // "S8", "T4", "IR 55"; long train numbers ("IC 1027") fall back to the category.
  let line = num ? cat + (long ? " " : "") + num : cat;
  if (w2(line) > BADGE_W - 4) line = cat;
  const delay = typeof s.delay === "number" ? s.delay : 0;
  const prog = s.prognosis && s.prognosis.platform;
  const plat = ascii(prog || s.platform || "");
  return {
    time: String(s.departure || "").slice(11, 16) || "--:--",
    late: delay > 0 ? "+" + delay : "",
    line: line,
    lineCol: long ? "#FFFFFF" : "#0B2A6B",
    badge: long ? "#E2001A" : "#FFFFFF",
    by: y + 5,
    dest: fit2(ascii(d.to || "?"), 146),
    plat: plat,
    platCol: prog && prog !== s.platform ? "#FFD23F" : "#FFFFFF",
    sep: i > 0 ? y - 1 : HIDE,
  };
}

const R = [0, 1, 2, 3, 4, 5].map(row);
export const t1 = R[0].time, d1 = R[0].late, l1 = R[0].line, lc1 = R[0].lineCol, b1 = R[0].badge, by1 = R[0].by, n1 = R[0].dest, p1 = R[0].plat, pc1 = R[0].platCol;
export const t2 = R[1].time, d2 = R[1].late, l2 = R[1].line, lc2 = R[1].lineCol, b2 = R[1].badge, by2 = R[1].by, n2 = R[1].dest, p2 = R[1].plat, pc2 = R[1].platCol, s2 = R[1].sep;
export const t3 = R[2].time, d3 = R[2].late, l3 = R[2].line, lc3 = R[2].lineCol, b3 = R[2].badge, by3 = R[2].by, n3 = R[2].dest, p3 = R[2].plat, pc3 = R[2].platCol, s3 = R[2].sep;
export const t4 = R[3].time, d4 = R[3].late, l4 = R[3].line, lc4 = R[3].lineCol, b4 = R[3].badge, by4 = R[3].by, n4 = R[3].dest, p4 = R[3].plat, pc4 = R[3].platCol, s4 = R[3].sep;
export const t5 = R[4].time, d5 = R[4].late, l5 = R[4].line, lc5 = R[4].lineCol, b5 = R[4].badge, by5 = R[4].by, n5 = R[4].dest, p5 = R[4].plat, pc5 = R[4].platCol, s5 = R[4].sep;
export const t6 = R[5].time, d6 = R[5].late, l6 = R[5].line, lc6 = R[5].lineCol, b6 = R[5].badge, by6 = R[5].by, n6 = R[5].dest, p6 = R[5].plat, pc6 = R[5].platCol, s6 = R[5].sep;

export const none = board ? (deps.length ? "" : "NO DEPARTURES") : "NO DATA";
`;

const BG = "#0B2A6B"; // SBB board blue
const HDR = "#061A45";
const LABEL = "#9DB5E8";
const SEP = "#24468F";

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header: station and Swiss local time
  ["fillRect", 0, 0, 320, 28, HDR],
  ["text", "{station}", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "ABFAHRT", 252, 14, 1, 1, "MR", LABEL],
  ["text", "{clock}", 312, 14, 2, 1, "MR", "#FFFFFF"],
  // Column labels
  ["text", "TIME", 8, 34, 1, 1, "TL", LABEL],
  ["text", "LINE", 78, 34, 1, 1, "TL", LABEL],
  ["text", "DESTINATION", 124, 34, 1, 1, "TL", LABEL],
  ["text", "PL.", 312, 34, 1, 1, "TR", LABEL],
  // Departure rows: time, delay (red), line badge, destination, platform (yellow if changed)
  ...[1, 2, 3, 4, 5, 6].flatMap((n): RawWireOp[] => {
    const y = 48 + (n - 1) * 31;
    const sep: RawWireOp[] = n > 1 ? [["drawFastHLine", 8, `{s${n}}`, 304, SEP]] : [];
    return [
      ...sep,
      ["text", `{t${n}}`, 8, y + 7, 2, 1, "TL", "#FFFFFF"],
      ["text", `{d${n}}`, 50, y + 7, 2, 1, "TL", "#FF6B6B"],
      ["fillRoundRect", 76, `{by${n}}`, 40, 20, 3, `{b${n}}`],
      ["text", `{l${n}}`, 96, y + 15, 2, 1, "MC", `{lc${n}}`],
      ["text", `{n${n}}`, 124, y + 7, 2, 1, "TL", "#FFFFFF"],
      ["text", `{p${n}}`, 312, y + 7, 2, 1, "TR", `{pc${n}}`],
    ];
  }),
  ["text", "{none}", 160, 130, 4, 1, "MC", "#FF6B6B"],
];

const template: Template = {
  id: "swiss-departures",
  name: "Swiss station board",
  description: "A Swiss-style blue departure board: the next six trains with line, destination, platform and delays.",
  apis: ["transport.opendata.ch"],
  category: "transport",
  dataCode: code,
  rows: rows("swiss-departures", wire),
  sampleVars: {"b1":"#FFFFFF","b2":"#FFFFFF","b3":"#FFFFFF","b4":"#E2001A","b5":"#FFFFFF","b6":"#FFFFFF","by1":53,"by2":84,"by3":115,"by4":146,"by5":177,"by6":208,"clock":"15:26","d1":"+3","d2":"","d3":"+1","d4":"","d5":"","d6":"+1","l1":"S3","l2":"S9","l3":"S11","l4":"IR 55","l5":"S6","l6":"S6","lc1":"#0B2A6B","lc2":"#0B2A6B","lc3":"#0B2A6B","lc4":"#FFFFFF","lc5":"#0B2A6B","lc6":"#0B2A6B","n1":"Zurich Hardbrucke","n2":"Uster","n3":"Aarau","n4":"Biel/Bienne","n5":"Uetikon","n6":"Baden","none":"","p1":"41/42","p2":"43/44","p3":"41/42","p4":"17","p5":"43/44","p6":"41/42","pc1":"#FFFFFF","pc2":"#FFFFFF","pc3":"#FFFFFF","pc4":"#FFFFFF","pc5":"#FFFFFF","pc6":"#FFFFFF","s2":78,"s3":109,"s4":140,"s5":171,"s6":202,"station":"ZURICH HB","t1":"15:26","t2":"15:28","t3":"15:29","t4":"15:29","t5":"15:30","t6":"15:31"},
};

export default template;
