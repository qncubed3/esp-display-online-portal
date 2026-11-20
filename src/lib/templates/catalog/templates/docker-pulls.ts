import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Docker Hub pulls

const dataCode = String.raw`// Total pulls, stars, last update and age of one Docker Hub image.
// Docker Hub's v2 API is keyless (about 180 requests per window), and pull counts move slowly, so cache for an hour.
const IMAGE = "library/nginx"; // "library/<name>" for official images, or "<user>/<repo>"

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 13619646703 -> "13.62B", 21426 -> "21.4k"
function compact(n) {
  const fmt = (v, s) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + s;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B"; // billions get two decimals so the count visibly ticks
  if (n >= 1e6) return fmt(n / 1e6, "M");
  if (n >= 1e4) return fmt(n / 1e3, "k");
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

// "2014-06-05T19:14:45Z" -> "Jun 2014"
function since(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || "");
  return m ? MON[Number(m[2]) - 1] + " " + m[1] : "--";
}

const ascii = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "");
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+$/, "") + "." : s);

let r = null;
try {
  r = await get("https://hub.docker.com/v2/repositories/" + IMAGE + "/", { cache: 3600 });
} catch (e) {
  console.log("docker hub failed:", e.message);
}

const ok = r && typeof r === "object" && typeof r.pull_count === "number";
const ns = ok ? ascii(r.namespace) : "";

export const image = cut(ascii(ok ? r.name : IMAGE.split("/").pop()), 20);
export const owner = ok ? (ns === "library" ? "OFFICIAL IMAGE" : cut(ns, 20)) : "";
export const desc = ok ? cut(ascii(r.description).trim(), 42) : "Docker Hub unavailable";
export const pulls = ok ? compact(r.pull_count) : "--";
export const stars = ok ? compact(r.star_count) : "--";
export const updated = ok ? ago(r.last_updated) : "--";
export const created = ok ? since(r.date_registered) : "--";
export const time = now("HH:mm");
`;

const BLUE = "#1D63ED";
const GREY = "#8B949E";
const CARD = "#14202E";

const wire: RawWireOp[] = [
  ["fillScreen", "#0B1220"],
  ["fillRect", 0, 0, 320, 28, BLUE],
  ["text", "Docker Hub", 10, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{time}", 310, 14, 2, 1, "MR", "#FFFFFF"],

  ["text", "{image}", 10, 38, 4, 1, "TL", "#FFFFFF"],
  ["text", "{owner}", 310, 44, 2, 1, "TR", "#2496ED"],
  ["text", "{desc}", 10, 66, 2, 1, "TL", GREY],

  ["drawFastVLine", 10, 92, 54, BLUE],
  ["drawFastVLine", 11, 92, 54, BLUE],
  ["text", "{pulls}", 22, 94, 4, 2, "TL", "#FFFFFF"],
  ["text", "TOTAL PULLS", 22, 150, 1, 1, "TL", GREY],

  ...([
    [8, "{stars}", "STARS"],
    [112, "{updated}", "UPDATED"],
    [216, "{created}", "ON HUB SINCE"],
  ] as const).flatMap(([x, value, label]): RawWireOp[] => [
    ["fillRoundRect", x, 170, 96, 60, 6, CARD],
    ["text", label, x + 48, 180, 1, 1, "TC", GREY],
    ["text", value, x + 48, 200, 2, 1, "TC", "#FFFFFF"],
  ]),
];

const template: Template = {
  id: "docker-pulls",
  name: "Docker Hub pulls",
  description: "Total pulls of one Docker Hub image in big type, with stars, last update and how long it has been on the Hub.",
  apis: ["Docker Hub"],
  category: "tech",
  dataCode,
  rows: rows("docker-pulls", wire),
  sampleVars: {"created":"Jun 2014","desc":"Official build of Nginx.","image":"nginx","owner":"OFFICIAL IMAGE","pulls":"13.62B","stars":"21.4k","time":"01:23","updated":"13h ago"},
};

export default template;
