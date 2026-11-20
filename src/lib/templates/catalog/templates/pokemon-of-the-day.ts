import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Pokemon of the day: a Pokedex card for one of the original 151, picked from the day of the year.

const code = String.raw`// A different original-151 Pokemon each day (day of year), from PokeAPI (free, no key).
// The data never changes, so it is cached for a day.
const MAX_ID = 151; // pick from #1..MAX_ID

// Day of year in the owner's timezone -> Pokedex number.
const Y = Number(now("YYYY")), M = Number(now("MM")), D = Number(now("DD"));
const doy = Math.round((Date.UTC(Y, M - 1, D) - Date.UTC(Y, 0, 1)) / 86400000) + 1;
const id = ((doy - 1) % MAX_ID) + 1;

let p = null;
try {
  const res = await get("https://pokeapi.co/api/v2/pokemon/" + id, { cache: 86400 });
  if (res && typeof res === "object" && Array.isArray(res.stats)) p = res;
} catch (e) {
  console.log("pokemon-of-the-day: " + e.message);
}

const TYPE_COL = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030", grass: "#78C850",
  ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0", ground: "#E0C068", flying: "#A890F0",
  psychic: "#F85888", bug: "#A8B820", rock: "#B8A038", ghost: "#705898", dragon: "#7038F8",
  dark: "#705848", steel: "#B8B8D0", fairy: "#EE99AC",
};
const DARK_TEXT = { electric: 1, ice: 1, ground: 1, steel: 1, normal: 1, bug: 1, rock: 1, fairy: 1, grass: 1 };

// Font 2 glyph widths (chars 32-126), to size the type pills.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s) => [...s].reduce((n, c) => n + (W2[c.charCodeAt(0) - 32] || 0), 0);

const NAMES = { "nidoran-f": "Nidoran F", "nidoran-m": "Nidoran M", "mr-mime": "Mr. Mime", farfetchd: "Farfetch'd" };
const cap = (s) => NAMES[s] || String(s).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export const num = "#" + String(p ? p.id : id).padStart(3, "0");
export const name = p ? cap(p.name).replace(/[^\x20-\x7E]/g, "") : "No data";
export const height = p ? (p.height / 10).toFixed(1) + " m" : "--";
export const weight = p ? (p.weight / 10).toFixed(1) + " kg" : "--";

// Type pills, laid out left to right from x = 8; a missing second type goes off-screen.
const types = p ? p.types.slice().sort((a, b) => a.slot - b.slot).map((t) => t.type.name) : [];
let x = 8;
function pill(i) {
  const t = types[i];
  if (!t) return { label: "", x: -200, w: 0, col: "#000000", fg: "#000000" };
  const label = t.toUpperCase();
  const w = width(label) + 16;
  const out = { label, x, w, col: TYPE_COL[t] || "#888888", fg: DARK_TEXT[t] ? "#202020" : "#FFFFFF" };
  x += w + 6;
  return out;
}
const t1 = pill(0), t2 = pill(1);
export const t1_label = t1.label, t1_x = t1.x, t1_w = t1.w, t1_col = t1.col, t1_fg = t1.fg, t1_cx = Math.round(t1.x + t1.w / 2);
export const t2_label = t2.label, t2_x = t2.x, t2_w = t2.w, t2_col = t2.col, t2_fg = t2.fg, t2_cx = Math.round(t2.x + t2.w / 2);

// Base stats, bars scaled to 255 over a 226 px track.
const TRACK = 226;
const KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
const statCol = (v) => (v < 50 ? "#F05A4A" : v < 80 ? "#F0A030" : v < 100 ? "#F0D040" : v < 120 ? "#80D050" : "#40C8B0");
const stats = KEYS.map((k) => {
  const s = p && p.stats.find((x) => x.stat && x.stat.name === k);
  return s ? s.base_stat : 0;
});
const vs = stats.map((v) => (p ? String(v) : "--"));
const ws = stats.map((v) => Math.max(v > 0 ? 2 : 0, Math.round((Math.min(v, 255) / 255) * TRACK)));
const cs = stats.map(statCol);
export const hp = vs[0], hp_w = ws[0], hp_col = cs[0];
export const atk = vs[1], atk_w = ws[1], atk_col = cs[1];
export const def = vs[2], def_w = ws[2], def_col = cs[2];
export const spa = vs[3], spa_w = ws[3], spa_col = cs[3];
export const spd = vs[4], spd_w = ws[4], spd_col = cs[4];
export const spe = vs[5], spe_w = ws[5], spe_col = cs[5];
export const total = p ? "Total " + stats.reduce((a, b) => a + b, 0) : "";
export const date = now("ddd DD/MM");
`;

const BG = "#1C1C24";
const RED = "#D42A2A";
const WHITE = "#FFFFFF";
const MUTED = "#9098A8";
const TRACK_COL = "#33343F";

const STAT_TOP = 104;
const PITCH = 21;
const BAR_X = 84;
const BAR_W = 226;

const stat = (label: string, v: string, i: number): RawWireOp[] => {
  const y = STAT_TOP + i * PITCH;
  return [
    ["text", label, 8, y + 7, 2, 1, "ML", MUTED],
    ["text", `{${v}}`, 74, y + 7, 2, 1, "MR", WHITE],
    ["fillRoundRect", BAR_X, y + 1, BAR_W, 12, 3, TRACK_COL],
    ["fillRoundRect", BAR_X, y + 1, `{${v}_w}`, 12, 3, `{${v}_col}`],
  ];
};

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Red Pokedex header with the blue lens.
  ["fillRect", 0, 0, 320, 32, RED],
  ["fillRect", 0, 32, 320, 2, "#7A1010"],
  ["fillCircle", 18, 16, 11, WHITE],
  ["fillCircle", 18, 16, 8, "#2E8BEA"],
  ["fillCircle", 15, 13, 2, "#BFE3FF"],
  ["fillCircle", 38, 9, 3, "#F8D030"],
  ["fillCircle", 47, 9, 3, "#5BC85B"],
  ["text", "POKEDEX", 56, 17, 4, 1, "ML", WHITE],
  ["text", "{date}", 312, 17, 2, 1, "MR", WHITE],
  // Number and name.
  ["text", "{num}", 8, 42, 4, 1, "TL", MUTED],
  ["text", "{name}", 76, 42, 4, 1, "TL", WHITE],
  // Type pills.
  ["fillRoundRect", "{t1_x}", 74, "{t1_w}", 20, 10, "{t1_col}"],
  ["text", "{t1_label}", "{t1_cx}", 84, 2, 1, "MC", "{t1_fg}"],
  ["fillRoundRect", "{t2_x}", 74, "{t2_w}", 20, 10, "{t2_col}"],
  ["text", "{t2_label}", "{t2_cx}", 84, 2, 1, "MC", "{t2_fg}"],
  // Height and weight.
  ["text", "HEIGHT", 186, 72, 1, 1, "TL", MUTED],
  ["text", "{height}", 186, 82, 2, 1, "TL", WHITE],
  ["text", "WEIGHT", 248, 72, 1, 1, "TL", MUTED],
  ["text", "{weight}", 248, 82, 2, 1, "TL", WHITE],
  ["drawFastHLine", 8, 100, 304, "#3A3B48"],
  // Base stats.
  ...stat("HP", "hp", 0),
  ...stat("Atk", "atk", 1),
  ...stat("Def", "def", 2),
  ...stat("SpA", "spa", 3),
  ...stat("SpD", "spd", 4),
  ...stat("Spe", "spe", 5),
  // Footer.
  ["text", "{total}", 8, 233, 1, 1, "ML", MUTED],
  ["text", "pokeapi.co", 312, 233, 1, 1, "MR", MUTED],
];

const template: Template = {
  id: "pokemon-of-the-day",
  name: "Pokemon of the day",
  description: "A Pokedex card for a different original-151 Pokemon each day: types, size and base stat bars.",
  apis: ["PokeAPI"],
  category: "fun",
  dataCode: code,
  rows: rows("pokemon-of-the-day", wire),
  sampleVars: {"atk":"84","atk_col":"#F0D040","atk_w":74,"date":"Sat 21/11","def":"78","def_col":"#F0A030","def_w":69,"height":"1.7 m","hp":"78","hp_col":"#F0A030","hp_w":69,"name":"Charizard","num":"#006","spa":"109","spa_col":"#80D050","spa_w":97,"spd":"85","spd_col":"#F0D040","spd_w":75,"spe":"100","spe_col":"#80D050","spe_w":89,"t1_col":"#F08030","t1_cx":30,"t1_fg":"#FFFFFF","t1_label":"FIRE","t1_w":44,"t1_x":8,"t2_col":"#A890F0","t2_cx":88,"t2_fg":"#FFFFFF","t2_label":"FLYING","t2_w":59,"t2_x":58,"total":"Total 534","weight":"90.5 kg"},
};

export default template;
