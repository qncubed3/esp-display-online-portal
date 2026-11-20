import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Is the ISS near me? Distance, compass bearing and elevation from Melbourne to the
// International Space Station, and whether it can be seen right now.

// Compass geometry. Data and Draw both use these numbers.
const CX = 76;
const CY = 112;
const R = 58;
const ARROW = 44;

const code = String.raw`// How far the International Space Station is from you, from wheretheiss.at (free, no key).
// Distance is along the ground to the point under the ISS; the arrow is the compass bearing.
// "Visible" means above 10 deg elevation, in sunlight, while your sky is dark.
const PLACE = "MELBOURNE";
const LAT = -37.81;
const LON = 144.96;
const NEAR_KM = 1500; // background turns green when closer than this at night

const CX = ${CX}, CY = ${CY}, ARROW = ${ARROW}; // keep in step with Draw
const OFF = -200; // off-screen coordinate hides the arrow
const RE = 6371; // Earth radius, km
const D = Math.PI / 180;

export const place = "ISS FROM " + PLACE;
export const clock = now("HH:mm");

let iss = null;
try {
  iss = await get("https://api.wheretheiss.at/v1/satellites/25544", { cache: 30 });
} catch (e) {
  console.log("wheretheiss failed:", e.message);
}
const ok = iss && typeof iss.latitude === "number" && typeof iss.longitude === "number";

// Central angle (radians) between two lat/lon points (haversine).
function angle(la1, lo1, la2, lo2) {
  const a = Math.sin(((la2 - la1) * D) / 2) ** 2 +
    Math.cos(la1 * D) * Math.cos(la2 * D) * Math.sin(((lo2 - lo1) * D) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
// Initial compass bearing (deg) from point 1 towards point 2.
function bearing(la1, lo1, la2, lo2) {
  const y = Math.sin((lo2 - lo1) * D) * Math.cos(la2 * D);
  const x = Math.cos(la1 * D) * Math.sin(la2 * D) - Math.sin(la1 * D) * Math.cos(la2 * D) * Math.cos((lo2 - lo1) * D);
  return ((Math.atan2(y, x) / D) + 360) % 360;
}
const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

let km = 0, brg = 0, elev = -90, alt = 0;
if (ok) {
  const g = angle(LAT, LON, iss.latitude, iss.longitude);
  km = RE * g;
  brg = bearing(LAT, LON, iss.latitude, iss.longitude);
  alt = typeof iss.altitude === "number" ? iss.altitude : 420;
  // Elevation of the ISS above your horizon.
  elev = Math.atan2(Math.cos(g) - RE / (RE + alt), Math.sin(g)) / D;
}

// Sun height at your place, from the sub-solar point in the same response.
let sunElev = null;
if (ok && typeof iss.solar_lat === "number" && typeof iss.solar_lon === "number") {
  sunElev = 90 - angle(LAT, LON, iss.solar_lat, iss.solar_lon) / D;
}
const dark = sunElev !== null && sunElev < -6;
const twilight = sunElev !== null && sunElev >= -6 && sunElev < 0;
const sunlit = ok && iss.visibility === "daylight";
const visible = ok && elev >= 10 && sunlit && dark;
const near = ok && km < NEAR_KM && (dark || twilight);

export const dist = ok ? commas(Math.round(km)) : "--";
export const dir_name = ok ? POINTS[Math.round(brg / 22.5) % 16] : "--";
export const bear_txt = ok ? "BEARING " + Math.round(brg) % 360 + " DEG" : "";
export const elev_txt = ok ? String(Math.round(elev)) : "--";
export const alt_txt = ok ? String(Math.round(alt)) : "--";

export const status = !ok ? "NO DATA" : visible ? "VISIBLE NOW" : elev > 0 ? "ABOVE HORIZON" : "BELOW HORIZON";
export const status_fg = !ok ? "#A0B0C8" : visible ? "#60FF90" : elev > 0 ? "#FFD040" : "#A0B0C8";
export const sky_txt = !ok ? "" : "SKY " + (dark ? "DARK" : twilight ? "TWILIGHT" : sunElev === null ? "?" : "DAY") +
  " / ISS " + (sunlit ? "SUNLIT" : "SHADOW");

export const bg = near ? "#0A3A1A" : "#000000";
export const head = near ? "#145A2A" : "#0B1A33";
export const accent = near || visible ? "#60FF90" : "#FF5A4A";

// Arrow from the centre towards the ISS.
const ux = Math.sin(brg * D), uy = -Math.cos(brg * D);
const px = -uy, py = ux;
const pt = (r, s) => [Math.round(CX + ux * r + px * s), Math.round(CY + uy * r + py * s)];
const show = (v) => (ok ? v : OFF);
const tip = pt(ARROW, 0), b1 = pt(ARROW - 14, 7), b2 = pt(ARROW - 14, -7);
const s1 = pt(ARROW - 14, 1), s2 = pt(ARROW - 14, -1), c1 = pt(0, 1), c2 = pt(0, -1);
export const h_x = show(tip[0]), h_y = show(tip[1]);
export const b1_x = show(b1[0]), b1_y = show(b1[1]);
export const b2_x = show(b2[0]), b2_y = show(b2[1]);
export const c_x = show(CX), c_y = show(CY);
export const m_x = show(pt(ARROW - 14, 0)[0]), m_y = show(pt(ARROW - 14, 0)[1]);
export const s1_x = show(s1[0]), s1_y = show(s1[1]), c1_x = show(c1[0]), c1_y = show(c1[1]);
export const s2_x = show(s2[0]), s2_y = show(s2[1]), c2_x = show(c2[0]), c2_y = show(c2[1]);
`;

const CARD = "#14243A";
const LABEL = "#8FA8C8";
const RING = "#4A6488";

// 16 ticks round the rim: long for N/E/S/W.
const ticks: RawWireOp[] = [];
for (let i = 0; i < 16; i++) {
  const a = (i * 22.5 * Math.PI) / 180;
  const len = i % 4 === 0 ? 8 : i % 2 === 0 ? 6 : 3;
  const sx = Math.sin(a), sy = -Math.cos(a);
  ticks.push([
    "drawLine",
    Math.round(CX + sx * (R - len)),
    Math.round(CY + sy * (R - len)),
    Math.round(CX + sx * R),
    Math.round(CY + sy * R),
    i % 4 === 0 ? "#FFFFFF" : RING,
  ]);
}

const wire: RawWireOp[] = [
  ["fillScreen", "{bg}"],
  // Header
  ["fillRect", 0, 0, 320, 26, "{head}"],
  ["text", "{place}", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{clock}", 312, 13, 2, 1, "MR", "#C0D0E0"],
  // Compass
  ["fillCircle", CX, CY, R, "#0E1626"],
  ["drawCircle", CX, CY, R, RING],
  ["drawCircle", CX, CY, R - 1, RING],
  ...ticks,
  ["text", "N", CX, CY - 42, 2, 1, "MC", "#FF6060"],
  ["text", "E", CX + 43, CY, 2, 1, "MC", "#FFFFFF"],
  ["text", "S", CX, CY + 43, 2, 1, "MC", "#FFFFFF"],
  ["text", "W", CX - 43, CY, 2, 1, "MC", "#FFFFFF"],
  ["drawLine", "{c1_x}", "{c1_y}", "{s1_x}", "{s1_y}", "{accent}"],
  ["drawLine", "{c2_x}", "{c2_y}", "{s2_x}", "{s2_y}", "{accent}"],
  ["drawLine", "{c_x}", "{c_y}", "{m_x}", "{m_y}", "{accent}"],
  ["fillTriangle", "{h_x}", "{h_y}", "{b1_x}", "{b1_y}", "{b2_x}", "{b2_y}", "{accent}"],
  ["fillCircle", CX, CY, 3, "#FFFFFF"],
  // Bearing under the compass
  ["text", "{dir_name}", CX, 178, 4, 1, "TC", "#FFFFFF"],
  ["text", "{bear_txt}", CX, 208, 1, 1, "TC", LABEL],
  // Distance card
  ["fillRoundRect", 150, 32, 164, 96, 6, CARD],
  ["text", "DISTANCE", 158, 40, 1, 1, "TL", LABEL],
  ["text", "{dist}", 232, 52, 4, 2, "TC", "#FFFFFF"],
  ["text", "KM AWAY", 232, 110, 1, 1, "TC", LABEL],
  // Elevation and altitude
  ["fillRoundRect", 150, 134, 80, 58, 6, CARD],
  ["text", "ELEVATION", 190, 141, 1, 1, "TC", LABEL],
  ["text", "{elev_txt}", 190, 153, 4, 1, "TC", "#FFFFFF"],
  ["text", "DEG", 190, 181, 1, 1, "TC", LABEL],
  ["fillRoundRect", 234, 134, 80, 58, 6, CARD],
  ["text", "ISS HEIGHT", 274, 141, 1, 1, "TC", LABEL],
  ["text", "{alt_txt}", 274, 153, 4, 1, "TC", "#FFFFFF"],
  ["text", "KM", 274, 181, 1, 1, "TC", LABEL],
  // Status
  ["fillRoundRect", 150, 198, 164, 38, 6, CARD],
  ["text", "{status}", 232, 210, 2, 1, "MC", "{status_fg}"],
  ["text", "{sky_txt}", 232, 227, 1, 1, "MC", LABEL],
];

const template: Template = {
  id: "iss-distance",
  name: "Is the ISS near me?",
  description: "How far the International Space Station is from Melbourne, which way to look, its elevation and whether it is visible now.",
  apis: ["Where the ISS at"],
  category: "space",
  dataCode: code,
  rows: rows("iss-distance", wire),
  sampleVars: {"accent":"#FF5A4A","alt_txt":"427","b1_x":102,"b1_y":95,"b2_x":92,"b2_y":85,"bear_txt":"BEARING 43 DEG","bg":"#000000","c_x":76,"c_y":112,"c1_x":77,"c1_y":113,"c2_x":75,"c2_y":111,"clock":"01:16","dir_name":"NE","dist":"3,161","elev_txt":"-7","h_x":106,"h_y":80,"head":"#0B1A33","m_x":97,"m_y":90,"place":"ISS FROM MELBOURNE","s1_x":97,"s1_y":91,"s2_x":96,"s2_y":90,"sky_txt":"SKY DARK / ISS SHADOW","status":"BELOW HORIZON","status_fg":"#A0B0C8"},
};

export default template;
