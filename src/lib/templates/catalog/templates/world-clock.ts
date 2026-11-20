import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// World clock: four quadrant cards (Melbourne, London, New York, Tokyo), each with the city,
// a big HH:MM, the weekday, the UTC offset and a sun or moon.

const code = String.raw`// Local time in four cities, daylight saving included.
// The QuickJS sandbox has no Intl, so each zone's offsets and DST window come from timeapi.io
// (free, no key; cached for an hour), and every poll computes the time from Date.now().
// Because the DST start and end instants are known, the switch happens at the exact moment
// even from a cached response. If a lookup fails, built-in DST rules are used instead.
const CITIES = [
  { name: "MELBOURNE", zone: "Australia/Melbourne", rule: "au", std: 600 },
  { name: "LONDON", zone: "Europe/London", rule: "eu", std: 0 },
  { name: "NEW YORK", zone: "America/New_York", rule: "us", std: -300 },
  { name: "TOKYO", zone: "Asia/Tokyo", rule: "", std: 540 },
];
const DAY_FROM = 6; // the sun shows from 06:00 to 17:59 local, the moon otherwise
const DAY_TO = 18;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n) => (n < 10 ? "0" : "") + n;
const nowMs = Date.now();

// UTC ms of the nth (n = -1: last) Sunday of a month (m 0-11), at a UTC hour.
function sunday(y, m, n, hourUtc) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    return Date.UTC(y, m, 1 + ((7 - first) % 7) + 7 * (n - 1), hourUtc);
  }
  const lastDay = new Date(Date.UTC(y, m + 1, 0));
  return Date.UTC(y, m, lastDay.getUTCDate() - lastDay.getUTCDay(), hourUtc);
}

// Fallback offset in minutes from the zone's fixed DST rule.
function ruleOffset(c) {
  const y = new Date(nowMs).getUTCFullYear();
  let dst = false;
  if (c.rule === "eu") dst = nowMs >= sunday(y, 2, -1, 1) && nowMs < sunday(y, 9, -1, 1);
  // US: 2nd Sunday of March 02:00 EST (07:00 UTC) to 1st Sunday of November 02:00 EDT (06:00 UTC)
  if (c.rule === "us") dst = nowMs >= sunday(y, 2, 2, 7) && nowMs < sunday(y, 10, 1, 6);
  // AU south-east: DST ends 1st Sunday of April 03:00 AEDT (16:00 UTC Sat), starts 1st Sunday of October 02:00 AEST (16:00 UTC Sat)
  if (c.rule === "au") dst = nowMs < sunday(y, 3, 1, 0) - 8 * 3600000 || nowMs >= sunday(y, 9, 1, 0) - 8 * 3600000;
  return c.std + (dst ? 60 : 0);
}

// Offset in minutes from timeapi.io, choosing standard or DST by the DST window's instants.
async function apiOffset(c) {
  const z = await get("https://timeapi.io/api/TimeZone/zone?timeZone=" + c.zone, { cache: 3600 });
  const std = z.standardUtcOffset.seconds / 60;
  const iv = z.dstInterval;
  if (z.hasDayLightSaving && iv && iv.dstStart && iv.dstEnd) {
    const inDst = nowMs >= Date.parse(iv.dstStart) && nowMs < Date.parse(iv.dstEnd);
    return inDst ? iv.dstOffsetToUtc.seconds / 60 : std;
  }
  return z.currentUtcOffset.seconds / 60;
}

let live = 0;
const out = [];
for (const c of CITIES) {
  let off;
  try {
    off = await apiOffset(c);
    if (typeof off !== "number" || !isFinite(off)) throw new Error("bad offset");
    live++;
  } catch (e) {
    console.log("timeapi.io " + c.zone + " failed:", e.message);
    off = ruleOffset(c);
  }
  const t = new Date(nowMs + off * 60000);
  const h = t.getUTCHours();
  const day = h >= DAY_FROM && h < DAY_TO;
  const a = Math.abs(off);
  out.push({
    name: c.name,
    time: pad(h) + ":" + pad(t.getUTCMinutes()),
    weekday: DAYS[t.getUTCDay()],
    utc: "UTC" + (off < 0 ? "-" : "+") + Math.floor(a / 60) + (a % 60 ? ":" + pad(a % 60) : ""),
    day: day,
  });
}

const u = new Date(nowMs);
export const header_right = "UTC " + pad(u.getUTCHours()) + ":" + pad(u.getUTCMinutes()) + (live < CITIES.length ? " *" : "");

export const c1_name = out[0].name;
export const c1_time = out[0].time;
export const c1_day = out[0].weekday;
export const c1_utc = out[0].utc;
export const c1_card = out[0].day ? "#1C2E4A" : "#151A2C";
export const c1_sun_y = out[0].day ? 46 : -200;
export const c1_moon_y = out[0].day ? -200 : 46;
export const c1_ray_y = out[0].day ? 35 : -200;

export const c2_name = out[1].name;
export const c2_time = out[1].time;
export const c2_day = out[1].weekday;
export const c2_utc = out[1].utc;
export const c2_card = out[1].day ? "#1C2E4A" : "#151A2C";
export const c2_sun_y = out[1].day ? 46 : -200;
export const c2_moon_y = out[1].day ? -200 : 46;
export const c2_ray_y = out[1].day ? 35 : -200;

export const c3_name = out[2].name;
export const c3_time = out[2].time;
export const c3_day = out[2].weekday;
export const c3_utc = out[2].utc;
export const c3_card = out[2].day ? "#1C2E4A" : "#151A2C";
export const c3_sun_y = out[2].day ? 152 : -200;
export const c3_moon_y = out[2].day ? -200 : 152;
export const c3_ray_y = out[2].day ? 141 : -200;

export const c4_name = out[3].name;
export const c4_time = out[3].time;
export const c4_day = out[3].weekday;
export const c4_utc = out[3].utc;
export const c4_card = out[3].day ? "#1C2E4A" : "#151A2C";
export const c4_sun_y = out[3].day ? 152 : -200;
export const c4_moon_y = out[3].day ? -200 : 152;
export const c4_ray_y = out[3].day ? 141 : -200;
`;

const SUN = "#FFC830";
const MOON = "#D8DCF0";
const LABEL = "#A0B0C8";

// One quadrant card at (x, y), 151 x 100, using the cN_* vars.
function card(n: number, x: number, y: number): RawWireOp[] {
  const v = (k: string) => `{c${n}_${k}}`;
  const ix = x + 134; // sun / moon centre x
  return [
    ["fillRoundRect", x, y, 151, 100, 6, v("card")],
    ["text", v("name"), x + 10, y + 9, 2, 1, "TL", LABEL],
    // Sun: disc with four short rays
    ["drawFastHLine", ix - 11, v("sun_y"), 22, SUN],
    ["drawFastVLine", ix, v("ray_y"), 23, SUN],
    ["fillCircle", ix, v("sun_y"), 6, SUN],
    // Moon: crescent (a disc with the card colour bitten out)
    ["fillCircle", ix, v("moon_y"), 7, MOON],
    ["fillCircle", ix + 4, v("moon_y"), 6, v("card")],
    ["text", v("time"), x + 76, y + 53, 4, 2, "MC", "#FFFFFF"],
    ["text", v("day"), x + 10, y + 96, 2, 1, "BL", "#FFFFFF"],
    ["text", v("utc"), x + 141, y + 93, 1, 1, "BR", LABEL],
  ];
}

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 26, "#0C1A33"],
  ["text", "WORLD CLOCK", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{header_right}", 312, 13, 2, 1, "MR", LABEL],
  ...card(1, 6, 30),
  ...card(2, 163, 30),
  ...card(3, 6, 136),
  ...card(4, 163, 136),
];

const template: Template = {
  id: "world-clock",
  name: "World clock",
  description: "Local time in Melbourne, London, New York and Tokyo, with the weekday, UTC offset (daylight saving included) and a sun or moon for day or night.",
  apis: ["timeapi.io"],
  category: "clocks",
  dataCode: code,
  rows: rows("world-clock", wire),
  sampleVars: {"c1_card":"#151A2C","c1_day":"Saturday","c1_moon_y":46,"c1_name":"MELBOURNE","c1_ray_y":-200,"c1_sun_y":-200,"c1_time":"01:04","c1_utc":"UTC+11","c2_card":"#1C2E4A","c2_day":"Friday","c2_moon_y":-200,"c2_name":"LONDON","c2_ray_y":35,"c2_sun_y":46,"c2_time":"14:04","c2_utc":"UTC+0","c3_card":"#1C2E4A","c3_day":"Friday","c3_moon_y":-200,"c3_name":"NEW YORK","c3_ray_y":141,"c3_sun_y":152,"c3_time":"09:04","c3_utc":"UTC-5","c4_card":"#151A2C","c4_day":"Friday","c4_moon_y":152,"c4_name":"TOKYO","c4_ray_y":-200,"c4_sun_y":-200,"c4_time":"23:04","c4_utc":"UTC+9","header_right":"UTC 14:04"},
};

export default template;
