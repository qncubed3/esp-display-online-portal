import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// A cat fact (catfact.ninja) and a dog fact (dogapi.dog) in two stacked panels.
// Each minute the two swap: one gets the big panel, the other the small strip.
const CACHE = 900; // seconds; both APIs are free and keyless

const ascii = (s) =>
  String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

let cat = "Cats sleep for around 13 to 16 hours a day.";
try {
  const r = await get("https://catfact.ninja/fact?max_length=140", { cache: CACHE });
  if (r && r.fact) cat = ascii(r.fact).replace(/\\"/g, '"');
} catch (e) {
  console.log("cat fact failed:", e.message);
}

let dog = "A dog's nose print is unique, just like a human's fingerprint.";
try {
  const r = await get("https://dogapi.dog/api/v2/facts?limit=1", { cache: CACHE });
  const body = r && r.data && r.data[0] && r.data[0].attributes && r.data[0].attributes.body;
  if (body) dog = ascii(body);
} catch (e) {
  console.log("dog fact failed:", e.message);
}

// Font 2 glyph widths (char code - 32), for measured word wrap.
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8,6];
const w2 = (s) => { let w = 0; for (const ch of s) w += W2[ch.charCodeAt(0) - 32] || 7; return w; };
const w1 = (s) => s.length * 6;

function wrap(text, maxW, maxLines, measure) {
  const words = text.split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const t = line ? line + " " + words[i] : words[i];
    if (line && measure(t) > maxW) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    } else line = t;
  }
  if (lines.length < maxLines && line) { lines.push(line); line = ""; i = words.length; }
  if (i < words.length) {
    let last = lines[maxLines - 1];
    while (last && measure(last + "...") > maxW) last = last.replace(/\s*\S+$/, "");
    lines[maxLines - 1] = last.replace(/[.,;:!?]+$/, "") + "...";
  }
  return lines;
}

const catBig = Number(now("mm")) % 2 === 0;
const bigText = catBig ? cat : dog;
const smallText = catBig ? dog : cat;

// Big panel y 30-170, small strip y 176-234. Text area x 72-308.
const BIG_Y = 30, BIG_H = 140, SMALL_Y = 176;
const big = wrap(bigText, 234, 7, w2);
const small = wrap(smallText, 234, 4, w1);
const top = Math.round(BIG_Y + 6 + (BIG_H - 12 - big.length * 18) / 2);
const pad = (a, n) => { const o = a.slice(); while (o.length < n) o.push(""); return o; };
const b = pad(big, 7), s = pad(small, 4);

export const b1 = b[0], b2 = b[1], b3 = b[2], b4 = b[3], b5 = b[4], b6 = b[5], b7 = b[6];
export const by1 = top, by2 = top + 18, by3 = top + 36, by4 = top + 54, by5 = top + 72, by6 = top + 90, by7 = top + 108;
export const s1 = s[0], s2 = s[1], s3 = s[2], s4 = s[3];
const stop = Math.round(SMALL_Y + 29 - (small.length * 12 - 4) / 2);
export const sy1 = stop, sy2 = stop + 12, sy3 = stop + 24, sy4 = stop + 36;

// Panel colours follow the animal.
const CAT_ACC = "#F0A040", CAT_BG = "#2A1A06";
const DOG_ACC = "#70B8F0", DOG_BG = "#0C1E2E";
export const big_acc = catBig ? CAT_ACC : DOG_ACC;
export const big_bg = catBig ? CAT_BG : DOG_BG;
export const small_acc = catBig ? DOG_ACC : CAT_ACC;
export const small_bg = catBig ? DOG_BG : CAT_BG;
export const big_label = catBig ? "CAT" : "DOG";

// Icon centres: in the big panel the icon sits near the top, in the strip it is centred.
const cc = catBig ? BIG_Y + 42 : SMALL_Y + 31;
const dc = catBig ? SMALL_Y + 31 : BIG_Y + 42;
export const c_ear_tip = cc - 24, c_ear_in = cc - 12, c_ear_out = cc - 4, c_head = cc;
export const c_eye = cc - 3, c_nose = cc + 5, c_nose_tip = cc + 9, c_wh1 = cc + 4, c_wh2 = cc + 9;
export const d_ear = dc - 16, d_head = dc, d_eye = dc - 4, d_snout = dc + 7, d_nose = dc + 4, d_tongue = dc + 11;
export const label_y = BIG_Y + 82;
export const time = now("HH:mm");
`;

const ICON_X = 38;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, 320, 24, "#1A1A1A"],
  ["text", "PET FACTS", 8, 12, 2, 1, "ML", "#FFFFFF"],
  ["text", "{time}", 312, 12, 2, 1, "MR", "#B0B0B0"],

  // Big panel
  ["fillRoundRect", 6, 30, 308, 140, 8, "{big_bg}"],
  ["drawRoundRect", 6, 30, 308, 140, 8, "{big_acc}"],
  ["text", "{big_label}", ICON_X, "{label_y}", 2, 1, "TC", "{big_acc}"],
  ["text", "FACT", ICON_X, 130, 1, 1, "TC", "#909090"],
  ["text", "{b1}", 72, "{by1}", 2, 1, "TL", "#FFFFFF"],
  ["text", "{b2}", 72, "{by2}", 2, 1, "TL", "#FFFFFF"],
  ["text", "{b3}", 72, "{by3}", 2, 1, "TL", "#FFFFFF"],
  ["text", "{b4}", 72, "{by4}", 2, 1, "TL", "#FFFFFF"],
  ["text", "{b5}", 72, "{by5}", 2, 1, "TL", "#FFFFFF"],
  ["text", "{b6}", 72, "{by6}", 2, 1, "TL", "#FFFFFF"],
  ["text", "{b7}", 72, "{by7}", 2, 1, "TL", "#FFFFFF"],

  // Small strip
  ["fillRoundRect", 6, 176, 308, 58, 6, "{small_bg}"],
  ["drawRoundRect", 6, 176, 308, 58, 6, "{small_acc}"],
  ["text", "{s1}", 72, "{sy1}", 1, 1, "TL", "#C8C8C8"],
  ["text", "{s2}", 72, "{sy2}", 1, 1, "TL", "#C8C8C8"],
  ["text", "{s3}", 72, "{sy3}", 1, 1, "TL", "#C8C8C8"],
  ["text", "{s4}", 72, "{sy4}", 1, 1, "TL", "#C8C8C8"],

  // Cat icon: triangle ears, round head, eyes, pink nose, whiskers
  ["fillTriangle", ICON_X - 18, "{c_ear_out}", ICON_X - 13, "{c_ear_tip}", ICON_X - 3, "{c_ear_in}", "#F0A040"],
  ["fillTriangle", ICON_X + 18, "{c_ear_out}", ICON_X + 13, "{c_ear_tip}", ICON_X + 3, "{c_ear_in}", "#F0A040"],
  ["fillCircle", ICON_X, "{c_head}", 17, "#F0A040"],
  ["fillCircle", ICON_X - 7, "{c_eye}", 3, "#1A1A1A"],
  ["fillCircle", ICON_X + 7, "{c_eye}", 3, "#1A1A1A"],
  ["fillTriangle", ICON_X - 3, "{c_nose}", ICON_X + 3, "{c_nose}", ICON_X, "{c_nose_tip}", "#F06080"],
  ["drawLine", ICON_X - 6, "{c_wh1}", ICON_X - 16, "{c_eye}", "#5A3A10"],
  ["drawLine", ICON_X - 6, "{c_wh2}", ICON_X - 16, "{c_wh2}", "#5A3A10"],
  ["drawLine", ICON_X + 6, "{c_wh1}", ICON_X + 16, "{c_eye}", "#5A3A10"],
  ["drawLine", ICON_X + 6, "{c_wh2}", ICON_X + 16, "{c_wh2}", "#5A3A10"],

  // Dog icon: floppy ears, round head, eyes, snout, nose, tongue
  ["fillCircle", ICON_X, "{d_head}", 16, "#C89060"],
  ["fillRoundRect", ICON_X - 22, "{d_ear}", 10, 26, 5, "#7A4E28"],
  ["fillRoundRect", ICON_X + 12, "{d_ear}", 10, 26, 5, "#7A4E28"],
  ["fillCircle", ICON_X - 6, "{d_eye}", 3, "#1A1A1A"],
  ["fillCircle", ICON_X + 6, "{d_eye}", 3, "#1A1A1A"],
  ["fillCircle", ICON_X, "{d_snout}", 7, "#E8C8A0"],
  ["fillCircle", ICON_X, "{d_nose}", 3, "#1A1A1A"],
  ["fillRect", ICON_X - 2, "{d_tongue}", 4, 4, "#F06080"],
];

const template: Template = {
  id: "pet-facts",
  name: "Cat and dog facts",
  description: "A cat fact and a dog fact with drawn pet icons; they swap the big panel every minute.",
  apis: ["catfact.ninja", "Dog API"],
  category: "fun",
  dataCode: code,
  rows: rows("pet-facts", wire),
  sampleVars: {"b1":"Cat's urine glows under a black light.","b2":"","b3":"","b4":"","b5":"","b6":"","b7":"","big_acc":"#F0A040","big_bg":"#2A1A06","big_label":"CAT","by1":91,"by2":109,"by3":127,"by4":145,"by5":163,"by6":181,"by7":199,"c_ear_in":60,"c_ear_out":68,"c_ear_tip":48,"c_eye":69,"c_head":72,"c_nose":77,"c_nose_tip":81,"c_wh1":76,"c_wh2":81,"d_ear":191,"d_eye":203,"d_head":207,"d_nose":211,"d_snout":214,"d_tongue":218,"label_y":112,"s1":"The longer a dog's nose, the more","s2":"effective it's internal cooling system.","s3":"","s4":"","small_acc":"#70B8F0","small_bg":"#0C1E2E","sy1":195,"sy2":207,"sy3":219,"sy4":231,"time":"01:24"},
};

export default template;
