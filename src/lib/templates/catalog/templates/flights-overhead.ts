import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Flights overhead: aircraft near a point, from adsb.fi open data.

const ROW_Y = 88; // first list row centre
const ROW_H = 30;
const N = 5;

const code = String.raw`// Aircraft within a radius of a point, from adsb.fi open data (free, no key, 1 req/s).
// Lowest airborne aircraft first: callsign, type, altitude (ft), ground speed (kt),
// distance (nm) and an arrow pointing along its track.
const PLACE = "MELBOURNE AIRPORT"; // header label, ASCII only
const LAT = -37.67;
const LON = 144.84;
const RADIUS_NM = 25; // adsb.fi allows up to 250

const ROW_Y = ${ROW_Y}, ROW_H = ${ROW_H}; // keep in step with Draw
const OFF = -200; // off-screen y for unused arrows

// adsb.fi first; adsb.lol (same shape, slower) as a backup.
const SOURCES = [
  "https://opendata.adsb.fi/api/v2/lat/" + LAT + "/lon/" + LON + "/dist/" + RADIUS_NM,
  "https://api.adsb.lol/v2/point/" + LAT + "/" + LON + "/" + RADIUS_NM,
];
let list = null;
for (const url of SOURCES) {
  try {
    const d = await get(url, { cache: 30 });
    if (d && Array.isArray(d.aircraft)) { list = d.aircraft; break; }
  } catch (e) {
    console.log("aircraft feed failed:", e.message);
  }
}
const all = list || [];
const air = all
  .filter((a) => typeof a.alt_baro === "number")
  .sort((a, b) => a.alt_baro - b.alt_baro);
const ground = all.length - air.length;

export const clock = now("HH:mm");
export const place = PLACE.slice(0, 22);
export const count = list ? String(air.length) : "--";
export const count_label = !list ? "NO DATA" : "AIRCRAFT IN THE AIR";
export const sub = !list ? "ADS-B feed unavailable" : "within " + RADIUS_NM + " nm" + (ground > 0 ? "  +" + ground + " on ground" : "");
export const none = list && air.length === 0 ? "Nothing airborne nearby" : "";

function fmtThousands(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function arrow(track, cx, cy) {
  const t = (track * Math.PI) / 180;
  const p = (ang, r) => [Math.round(cx + r * Math.sin(ang)), Math.round(cy - r * Math.cos(ang))];
  const a = p(t, 10), b = p(t + 2.4, 8), c = p(t - 2.4, 8);
  return [a[0], a[1], b[0], b[1], c[0], c[1]];
}

const out = {};
for (let i = 0; i < ${N}; i++) {
  const a = air[i];
  const k = i + 1;
  const cy = ROW_Y + i * ROW_H;
  if (!a) {
    out["cs" + k] = ""; out["ty" + k] = ""; out["alt" + k] = ""; out["spd" + k] = ""; out["dst" + k] = "";
    out["ax" + k] = 0; out["ay" + k] = OFF; out["bx" + k] = 0; out["by" + k] = OFF; out["cx" + k] = 0; out["cy" + k] = OFF;
    out["col" + k] = "#000000";
    continue;
  }
  const cs = String(a.flight || a.r || a.hex || "?").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  out["cs" + k] = cs.slice(0, 8);
  out["ty" + k] = String(a.t || "").toUpperCase().slice(0, 4);
  out["alt" + k] = fmtThousands(a.alt_baro);
  out["spd" + k] = typeof a.gs === "number" ? String(Math.round(a.gs)) : "--";
  out["dst" + k] = typeof a.dst === "number" ? a.dst.toFixed(1) : "--";
  const tr = typeof a.track === "number" ? a.track : typeof a.true_heading === "number" ? a.true_heading : null;
  const pts = tr === null ? [0, OFF, 0, OFF, 0, OFF] : arrow(tr, 16, cy);
  out["ax" + k] = pts[0]; out["ay" + k] = pts[1]; out["bx" + k] = pts[2]; out["by" + k] = pts[3]; out["cx" + k] = pts[4]; out["cy" + k] = pts[5];
  // Arrow colour by height: amber below 5,000 ft, green below 15,000 ft, cyan above.
  out["col" + k] = a.alt_baro < 5000 ? "#FFB020" : a.alt_baro < 15000 ? "#40D080" : "#40C8FF";
}

export const cs1 = out.cs1, ty1 = out.ty1, alt1 = out.alt1, spd1 = out.spd1, dst1 = out.dst1, col1 = out.col1;
export const cs2 = out.cs2, ty2 = out.ty2, alt2 = out.alt2, spd2 = out.spd2, dst2 = out.dst2, col2 = out.col2;
export const cs3 = out.cs3, ty3 = out.ty3, alt3 = out.alt3, spd3 = out.spd3, dst3 = out.dst3, col3 = out.col3;
export const cs4 = out.cs4, ty4 = out.ty4, alt4 = out.alt4, spd4 = out.spd4, dst4 = out.dst4, col4 = out.col4;
export const cs5 = out.cs5, ty5 = out.ty5, alt5 = out.alt5, spd5 = out.spd5, dst5 = out.dst5, col5 = out.col5;
export const ax1 = out.ax1, ay1 = out.ay1, bx1 = out.bx1, by1 = out.by1, cx1 = out.cx1, cy1 = out.cy1;
export const ax2 = out.ax2, ay2 = out.ay2, bx2 = out.bx2, by2 = out.by2, cx2 = out.cx2, cy2 = out.cy2;
export const ax3 = out.ax3, ay3 = out.ay3, bx3 = out.bx3, by3 = out.by3, cx3 = out.cx3, cy3 = out.cy3;
export const ax4 = out.ax4, ay4 = out.ay4, bx4 = out.bx4, by4 = out.by4, cx4 = out.cx4, cy4 = out.cy4;
export const ax5 = out.ax5, ay5 = out.ay5, bx5 = out.bx5, by5 = out.by5, cx5 = out.cx5, cy5 = out.cy5;
`;

const BG = "#05080F";
const HEAD = "#10203A";
const ACCENT = "#40C8FF";
const LABEL = "#7E93AE";
const TEXT = "#F0F4FA";
const SUB = "#B8C4D4";
const LINE = "#1C2A40";

// Columns
const X_CS = 32;
const X_TY = 108;
const X_ALT = 210; // right edge
const X_SPD = 256; // right edge
const X_DST = 312; // right edge

const rowWire: RawWireOp[] = Array.from({ length: N }, (_, i): RawWireOp[] => {
  const k = i + 1;
  const y = ROW_Y + i * ROW_H;
  return [
    ...(i > 0 ? [["drawFastHLine", 8, y - ROW_H / 2, 304, LINE] as RawWireOp] : []),
    ["fillTriangle", `{ax${k}}`, `{ay${k}}`, `{bx${k}}`, `{by${k}}`, `{cx${k}}`, `{cy${k}}`, `{col${k}}`],
    ["text", `{cs${k}}`, X_CS, y, 2, 1, "ML", TEXT],
    ["text", `{ty${k}}`, X_TY, y, 2, 1, "ML", ACCENT],
    ["text", `{alt${k}}`, X_ALT, y, 2, 1, "MR", TEXT],
    ["text", `{spd${k}}`, X_SPD, y, 2, 1, "MR", SUB],
    ["text", `{dst${k}}`, X_DST, y, 2, 1, "MR", SUB],
  ];
}).flat();

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  // Header
  ["fillRect", 0, 0, 320, 24, HEAD],
  ["text", "{place}", 8, 12, 2, 1, "ML", TEXT],
  ["text", "{clock}", 312, 12, 2, 1, "MR", SUB],
  // Summary: big count, label and radius
  ["text", "{count}", 8, 30, 4, 1, "TL", ACCENT],
  ["text", "{count_label}", 48, 31, 2, 1, "TL", TEXT],
  ["text", "{sub}", 48, 47, 1, 1, "TL", LABEL],
  // Column labels
  ["text", "FLIGHT", X_CS, 66, 1, 1, "TL", LABEL],
  ["text", "TYPE", X_TY, 66, 1, 1, "TL", LABEL],
  ["text", "ALT FT", X_ALT, 66, 1, 1, "TR", LABEL],
  ["text", "KT", X_SPD, 66, 1, 1, "TR", LABEL],
  ["text", "NM", X_DST, 66, 1, 1, "TR", LABEL],
  ["drawFastHLine", 8, 76, 304, LINE],
  ...rowWire,
  ["text", "{none}", 160, 150, 2, 1, "MC", LABEL],
];

const template: Template = {
  id: "flights-overhead",
  name: "Flights overhead",
  description: "Aircraft in the air near you, lowest first: callsign, type, altitude, speed, distance and a track arrow.",
  apis: ["adsb.fi", "adsb.lol"],
  category: "transport",
  dataCode: code,
  rows: rows("flights-overhead", wire),
  // Sample captured live over London Heathrow (busier than Melbourne at night).
  sampleVars: {"alt1":"450","alt2":"750","alt3":"1,200","alt4":"1,200","alt5":"1,200","ax1":26,"ax2":16,"ax3":26,"ax4":6,"ax5":25,"ay1":88,"ay2":108,"ay3":148,"ay4":177,"ay5":212,"bx1":10,"bx2":21,"bx3":10,"bx4":22,"bx5":9,"by1":93,"by2":124,"by3":153,"by4":173,"by5":211,"clock":"01:26","col1":"#FFB020","col2":"#FFB020","col3":"#FFB020","col4":"#FFB020","col5":"#FFB020","count":"39","count_label":"AIRCRAFT IN THE AIR","cs1":"SHT2J","cs2":"GBRBP","cs3":"BAW437Z","cs4":"FFC046","cs5":"UKP013","cx1":10,"cx2":10,"cx3":10,"cx4":22,"cx5":13,"cy1":83,"cy2":124,"cy3":143,"cy4":184,"cy5":201,"dst1":"0.3","dst2":"7.7","dst3":"4.1","dst4":"7.3","dst5":"23.5","none":"","place":"LONDON HEATHROW","spd1":"168","spd2":"68","spd3":"134","spd4":"83","spd5":"134","sub":"within 25 nm  +43 on ground","ty1":"A21N","ty2":"C152","ty3":"A21N","ty4":"P28A","ty5":"EC35"},
};

export default template;
