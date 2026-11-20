import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Country of the day: a different country each day, picked from a fixed list by day of year,
// with facts from Wikidata and a simple striped flag (or a code badge).

const code = String.raw`// A different country each day, chosen by day of year from the list below.
// Facts come from the Wikidata SPARQL endpoint (free, no key). REST Countries now needs a key.
const OFFSET = 0; // shift the rotation, e.g. 1 shows tomorrow's country today

// CODE|Name|Region|Currency code (picks the main currency when Wikidata lists several)
const COUNTRIES = [
  "JP|Japan|Eastern Asia|JPY", "FR|France|Western Europe|EUR", "BR|Brazil|South America|BRL",
  "KE|Kenya|Eastern Africa|KES", "CA|Canada|Northern America|CAD", "IT|Italy|Southern Europe|EUR",
  "IN|India|Southern Asia|INR", "MX|Mexico|Central America|MXN", "NG|Nigeria|Western Africa|NGN",
  "DE|Germany|Western Europe|EUR", "AR|Argentina|South America|ARS", "EG|Egypt|Northern Africa|EGP",
  "AU|Australia|Oceania|AUD", "IE|Ireland|Northern Europe|EUR", "TH|Thailand|South-eastern Asia|THB",
  "PE|Peru|South America|PEN", "RU|Russia|Eastern Europe|RUB", "ZA|South Africa|Southern Africa|ZAR",
  "NL|Netherlands|Western Europe|EUR", "KR|South Korea|Eastern Asia|KRW", "CO|Colombia|South America|COP",
  "BE|Belgium|Western Europe|EUR", "VN|Vietnam|South-eastern Asia|VND", "AT|Austria|Western Europe|EUR",
  "MA|Morocco|Northern Africa|MAD", "NZ|New Zealand|Oceania|NZD", "HU|Hungary|Eastern Europe|HUF",
  "CL|Chile|South America|CLP", "ID|Indonesia|South-eastern Asia|IDR", "PL|Poland|Eastern Europe|PLN",
  "ET|Ethiopia|Eastern Africa|ETB", "EE|Estonia|Northern Europe|EUR", "SN|Senegal|Western Africa|XOF",
  "UA|Ukraine|Eastern Europe|UAH", "GH|Ghana|Western Africa|GHS", "LT|Lithuania|Northern Europe|EUR",
  "SE|Sweden|Northern Europe|SEK", "BG|Bulgaria|Eastern Europe|EUR", "CU|Cuba|Caribbean|CUP",
  "RO|Romania|Eastern Europe|RON", "PH|Philippines|South-eastern Asia|PHP", "ML|Mali|Western Africa|XOF",
  "NO|Norway|Northern Europe|NOK", "GN|Guinea|Western Africa|GNF", "PT|Portugal|Southern Europe|EUR",
  "CI|Ivory Coast|Western Africa|XOF", "IS|Iceland|Northern Europe|ISK", "LU|Luxembourg|Western Europe|EUR",
  "GR|Greece|Southern Europe|EUR", "YE|Yemen|Western Asia|YER", "MN|Mongolia|Eastern Asia|MNT",
  "AM|Armenia|Western Asia|AMD", "FJ|Fiji|Melanesia|FJD", "BO|Bolivia|South America|BOB",
  "CH|Switzerland|Western Europe|CHF", "GA|Gabon|Middle Africa|XAF", "NP|Nepal|Southern Asia|NPR",
  "SL|Sierra Leone|Western Africa|SLE", "US|United States|Northern America|USD", "TD|Chad|Middle Africa|XAF",
  "ES|Spain|Southern Europe|EUR",
];

// Simple striped flags: H = horizontal stripes, V = vertical. Others get a code badge.
const FLAGS = {
  FR: "V #0055A4 #FFFFFF #EF4135", IT: "V #009246 #FFFFFF #CE2B37", IE: "V #169B62 #FFFFFF #FF883E",
  BE: "V #000000 #FDDA24 #EF3340", RO: "V #002B7F #FCD116 #CE1126", TD: "V #002664 #FECB00 #C60C30",
  ML: "V #14B53A #FCD116 #CE1126", GN: "V #CE1126 #FCD116 #009460", CI: "V #F77F00 #FFFFFF #009E60",
  NG: "V #008751 #FFFFFF #008751", PE: "V #D91023 #FFFFFF #D91023", SN: "V #00853F #FDEF42 #E31B23",
  MX: "V #006847 #FFFFFF #CE1126",
  DE: "H #000000 #DD0000 #FFCE00", NL: "H #AE1C28 #FFFFFF #21468B", RU: "H #FFFFFF #0039A6 #D52B1E",
  AT: "H #ED2939 #FFFFFF #ED2939", HU: "H #CD2A3E #FFFFFF #436F4D", EE: "H #0072CE #000000 #FFFFFF",
  LT: "H #FDB913 #006A44 #C1272D", BG: "H #FFFFFF #00966E #D62612", SL: "H #1EB53A #FFFFFF #0072C6",
  YE: "H #CE1126 #FFFFFF #000000", AM: "H #D90012 #0033A0 #F2A800", BO: "H #D52B1E #F9E300 #007934",
  GA: "H #009E60 #FCD116 #3A75C4", LU: "H #ED2939 #FFFFFF #00A1DE", IN: "H #FF9933 #FFFFFF #138808",
  UA: "H #0057B7 #FFD700", PL: "H #FFFFFF #DC143C", ID: "H #FF0000 #FFFFFF",
};

// ---- Pick today's country
const today = now("YYYY-MM-DD");
const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), d = Number(today.slice(8, 10));
const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
const n = COUNTRIES.length;
const pick = COUNTRIES[(((dayOfYear - 1 + OFFSET) % n) + n) % n].split("|");
const CODE = pick[0], NAME = pick[1], REGION = pick[2], CUR = pick[3];

// ---- Fetch facts from Wikidata (one query, cached a day)
const Q =
  'SELECT (GROUP_CONCAT(DISTINCT ?capL; separator="|") AS ?caps) (MAX(?pop) AS ?population) (MAX(?ar) AS ?area) ' +
  '(GROUP_CONCAT(DISTINCT ?curS; separator="|") AS ?curs) (GROUP_CONCAT(DISTINCT ?langL; separator="|") AS ?langs) ' +
  '(GROUP_CONCAT(DISTINCT ?d; separator="|") AS ?dial) WHERE { ' +
  '?c wdt:P297 "' + CODE + '" . ' +
  'OPTIONAL { ?c wdt:P36 ?cap . ?cap rdfs:label ?capL FILTER(LANG(?capL)="en") } ' +
  "OPTIONAL { ?c wdt:P1082 ?pop } OPTIONAL { ?c wdt:P2046 ?ar } " +
  'OPTIONAL { ?c wdt:P38 ?cu . ?cu rdfs:label ?curL FILTER(LANG(?curL)="en") OPTIONAL { ?cu wdt:P498 ?cc } ' +
  'BIND(IF(BOUND(?cc), CONCAT(?curL, " (", ?cc, ")"), ?curL) AS ?curS) } ' +
  'OPTIONAL { ?c wdt:P37 ?l . ?l rdfs:label ?langL FILTER(LANG(?langL)="en") } ' +
  "OPTIONAL { ?c wdt:P474 ?d } }";

// Wikidata occasionally answers with an empty row; the cache is per URL, so retry once
// with a SPARQL comment appended (a different URL) and a shorter cache.
let facts = null;
for (const [suffix, ttl] of [["", 86400], [" #retry", 3600]]) {
  try {
    let res = await get("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(Q + suffix), { cache: ttl });
    if (typeof res === "string") res = JSON.parse(res);
    const row = res && res.results && res.results.bindings && res.results.bindings[0];
    if (row && (row.population || row.caps)) {
      facts = row;
      break;
    }
  } catch (e) {
    console.log("wikidata failed:", e.message);
  }
}
const val = (k) => (facts && facts[k] && facts[k].value) || "";
const list = (k) => (val(k) ? val(k).split("|").filter(Boolean) : []);

// Fonts are ASCII only: strip accents, then anything else.
const ascii = (s) => {
  let t = String(s || "");
  try { t = t.normalize("NFD"); } catch (e) {}
  return t.replace(/[‘’]/g, "'").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
};
const cap1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const commas = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Glyph widths (px) of fonts 2 and 4 for chars 32-126, to fit text by real pixel width.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const width = (s, w) => [...s].reduce((t, c) => t + (w[c.charCodeAt(0) - 32] || 8), 0);
const fit = (s, w, max) => {
  if (width(s, w) <= max) return s;
  while (s.length > 1 && width(s + "...", w) > max) s = s.slice(0, -1);
  return s.trimEnd() + "...";
};
const VAL_MAX = 210; // px, value column x 102 to 312

// ---- Header and title
export const header_date = today.slice(8, 10) + "/" + today.slice(5, 7) + "/" + today.slice(0, 4);
export const name = fit(NAME, width(NAME, W4) <= 216 ? W4 : W2, 216);
export const name_font = width(NAME, W4) <= 216 ? 4 : 2;
export const region = REGION;

// ---- Facts
const caps = list("caps").map(ascii).sort();
export const capital = fit(caps.join(", ") || "--", W2, VAL_MAX);

const pop = Number(val("population"));
const short = pop >= 1e9 ? (pop / 1e9).toFixed(2) + " bn" : pop >= 1e6 ? (pop / 1e6).toFixed(1) + " m" : "";
export const population = pop > 0 ? commas(pop) + (short ? "  (" + short + ")" : "") : "--";

const area = Number(val("area"));
export const area_km = area > 0 ? commas(area) + " km2" : "--";

const curs = list("curs").map(ascii);
const cur = curs.find((c) => c.indexOf("(" + CUR + ")") >= 0) || curs[0] || CUR;
export const currency = fit(cap1(cur), W2, VAL_MAX);

const langs = list("langs")
  .map(ascii)
  .filter((l) => l && !/sign language/i.test(l) && !/^languages of/i.test(l))
  .sort();
export const languages = fit((CODE === "US" ? "English" : langs.join(", ")) || "--", W2, VAL_MAX);

const dials = list("dial").map(ascii).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
export const calling = dials[0] || "--";

// ---- Flag (stripes) or code badge, in the box x 8, y 36, 78 x 52
const BX = 8, BY = 36, BW = 78, BH = 52;
const spec = FLAGS[CODE] ? FLAGS[CODE].split(" ") : null;
const stripes = [];
if (spec) {
  const cols = spec.slice(1);
  const k = cols.length;
  for (let i = 0; i < k; i++) {
    if (spec[0] === "V") {
      const x0 = BX + Math.round((BW * i) / k), x1 = BX + Math.round((BW * (i + 1)) / k);
      stripes.push({ x: x0, y: BY, w: x1 - x0, h: BH, c: cols[i] });
    } else {
      const y0 = BY + Math.round((BH * i) / k), y1 = BY + Math.round((BH * (i + 1)) / k);
      stripes.push({ x: BX, y: y0, w: BW, h: y1 - y0, c: cols[i] });
    }
  }
}
const s = (i) => stripes[i] || { x: 0, y: -200, w: 1, h: 1, c: "#000000" };
export const s1x = s(0).x, s1y = s(0).y, s1w = s(0).w, s1h = s(0).h, s1c = s(0).c;
export const s2x = s(1).x, s2y = s(1).y, s2w = s(1).w, s2h = s(1).h, s2c = s(1).c;
export const s3x = s(2).x, s3y = s(2).y, s3w = s(2).w, s3h = s(2).h, s3c = s(2).c;
export const badge_y = spec ? -200 : BY;
export const badge_code = spec ? "" : CODE;
`;

const ACCENT = "#4FC3F7";
const LABEL = "#9AA4AE";
const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  // Header
  ["fillRect", 0, 0, 320, 26, "#0D3550"],
  ["text", "COUNTRY OF THE DAY", 8, 13, 2, 1, "ML", "#FFFFFF"],
  ["text", "{header_date}", 312, 13, 2, 1, "MR", ACCENT],
  // Flag stripes, or a badge with the country code
  ["fillRect", "{s1x}", "{s1y}", "{s1w}", "{s1h}", "{s1c}"],
  ["fillRect", "{s2x}", "{s2y}", "{s2w}", "{s2h}", "{s2c}"],
  ["fillRect", "{s3x}", "{s3y}", "{s3w}", "{s3h}", "{s3c}"],
  ["fillRoundRect", 8, "{badge_y}", 78, 52, 6, "#1E5A7A"],
  ["text", "{badge_code}", 47, 62, 4, 1, "MC", "#FFFFFF"],
  ["drawRect", 7, 35, 80, 54, "#606060"],
  // Name and region
  ["text", "{name}", 96, 50, "{name_font}", 1, "ML", "#FFFFFF"],
  ["text", "{region}", 96, 76, 2, 1, "ML", ACCENT],
  ["drawFastHLine", 8, 98, 304, "#30404C"],
  // Facts
  ...(
    [
      ["Capital", "{capital}"],
      ["Population", "{population}"],
      ["Area", "{area_km}"],
      ["Currency", "{currency}"],
      ["Languages", "{languages}"],
      ["Calling code", "{calling}"],
    ] as const
  ).flatMap(([label, v], i): RawWireOp[] => {
    const y = 106 + i * 21;
    return [
      ["text", label, 8, y, 2, 1, "TL", LABEL],
      ["text", v, 102, y, 2, 1, "TL", "#FFFFFF"],
    ];
  }),
];

const template: Template = {
  id: "country-of-the-day",
  name: "Country of the day",
  description: "A different country each day with its flag, capital, population, area, currency, languages and calling code.",
  apis: ["Wikidata"],
  category: "world",
  dataCode: code,
  rows: rows("country-of-the-day", wire),
  sampleVars: {
    area_km: "643,801 km2",
    badge_code: "",
    badge_y: -200,
    calling: "+33",
    capital: "Paris",
    currency: "Euro (EUR)",
    header_date: "21/11/2026",
    languages: "French",
    name: "France",
    name_font: 4,
    population: "68,605,616  (68.6 m)",
    region: "Western Europe",
    s1c: "#0055A4",
    s1h: 52,
    s1w: 26,
    s1x: 8,
    s1y: 36,
    s2c: "#FFFFFF",
    s2h: 52,
    s2w: 26,
    s2x: 34,
    s2y: 36,
    s3c: "#EF4135",
    s3h: 52,
    s3w: 26,
    s3x: 60,
    s3y: 36,
  },
};

export default template;
