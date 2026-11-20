import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

// Word of the day: a vocabulary word picked from the date, with a simple respelling,
// its part of speech in a pill, and its definition and example from the Free Dictionary API.

const code = String.raw`// Word of the day. The word is picked from the date out of the curated list below
// (word|respelling|part of speech), so it is the same all day and always defined.
// The definition and example come from Free Dictionary (dictionaryapi.dev, free, no key).
const WORDS = [
  "serendipity|ser-en-DIP-i-tee|noun",
  "ephemeral|ih-FEM-er-ul|adjective",
  "petrichor|PET-ri-kor|noun",
  "mellifluous|meh-LIF-loo-us|adjective",
  "ineffable|in-EF-uh-bul|adjective",
  "sonorous|SON-er-us|adjective",
  "luminous|LOO-mi-nus|adjective",
  "quintessential|kwin-tuh-SEN-shul|adjective",
  "ardent|AR-dunt|adjective",
  "labyrinth|LAB-uh-rinth|noun",
  "eloquent|EL-uh-kwent|adjective",
  "ubiquitous|yoo-BIK-wi-tus|adjective",
  "nostalgia|no-STAL-juh|noun",
  "resilience|ri-ZIL-yuns|noun",
  "wanderlust|WON-der-lust|noun",
  "zenith|ZEE-nith|noun",
  "cacophony|kuh-KOF-uh-nee|noun",
  "effervescent|ef-er-VES-ent|adjective",
  "gossamer|GOS-uh-mer|adjective",
  "incandescent|in-kan-DES-ent|adjective",
  "juxtapose|JUK-stuh-pohz|verb",
  "kaleidoscope|kuh-LY-duh-skohp|noun",
  "lackadaisical|lak-uh-DAY-zi-kul|adjective",
  "nebulous|NEB-yuh-lus|adjective",
  "oblivion|uh-BLIV-ee-un|noun",
  "panacea|pan-uh-SEE-uh|noun",
  "quixotic|kwik-SOT-ik|adjective",
  "reverie|REV-uh-ree|noun",
  "solitude|SOL-i-tood|noun",
  "tranquil|TRANG-kwil|adjective",
  "umbrage|UM-brij|noun",
  "verisimilitude|ver-uh-si-MIL-i-tood|noun",
  "whimsical|WIM-zi-kul|adjective",
  "zephyr|ZEF-er|noun",
  "alacrity|uh-LAK-ri-tee|noun",
  "benevolent|buh-NEV-uh-lent|adjective",
  "cognizant|KOG-ni-zunt|adjective",
  "diaphanous|dy-AF-uh-nus|adjective",
  "ebullient|ih-BUL-yunt|adjective",
  "fastidious|fa-STID-ee-us|adjective",
  "garrulous|GAR-uh-lus|adjective",
  "harbinger|HAR-bin-jer|noun",
  "pensive|PEN-siv|adjective",
  "jubilant|JOO-bi-lunt|adjective",
  "loquacious|loh-KWAY-shus|adjective",
  "magnanimous|mag-NAN-i-mus|adjective",
  "nefarious|ni-FAIR-ee-us|adjective",
  "obfuscate|OB-fuh-skayt|verb",
  "pernicious|per-NISH-us|adjective",
  "quandary|KWON-duh-ree|noun",
  "recalcitrant|ri-KAL-si-trunt|adjective",
  "sanguine|SANG-gwin|adjective",
  "tenacious|tuh-NAY-shus|adjective",
  "unctuous|UNGK-choo-us|adjective",
  "vicarious|vy-KAIR-ee-us|adjective",
  "wistful|WIST-ful|adjective",
  "zeitgeist|ZYT-gyst|noun",
  "yearn|YURN|verb",
  "zealous|ZEL-us|adjective",
  "aplomb|uh-PLOM|noun",
  "bucolic|byoo-KOL-ik|adjective",
  "cajole|kuh-JOHL|verb",
  "dauntless|DAWNT-lis|adjective",
  "enigma|ih-NIG-muh|noun",
  "felicity|fi-LIS-i-tee|noun",
  "gregarious|gri-GAIR-ee-us|adjective",
  "hubris|HYOO-bris|noun",
  "iridescent|ir-i-DES-ent|adjective",
  "jovial|JOH-vee-ul|adjective",
  "kinetic|ki-NET-ik|adjective",
  "languid|LANG-gwid|adjective",
  "meander|mee-AN-der|verb",
  "nonchalant|non-shuh-LAHNT|adjective",
  "opulent|OP-yuh-lent|adjective",
  "paradox|PAR-uh-doks|noun",
  "quagmire|KWAG-mire|noun",
  "reticent|RET-i-sunt|adjective",
  "sagacious|suh-GAY-shus|adjective",
  "taciturn|TAS-i-turn|adjective",
  "ultimatum|ul-ti-MAY-tum|noun",
  "vivacious|vi-VAY-shus|adjective",
  "wherewithal|WAIR-with-awl|noun",
  "aesthetic|es-THET-ik|adjective",
  "bombastic|bom-BAS-tik|adjective",
  "cathartic|kuh-THAR-tik|adjective",
  "demure|di-MYOOR|adjective",
  "exuberant|ig-ZOO-ber-unt|adjective",
  "flabbergast|FLAB-er-gast|verb",
  "gallivant|GAL-i-vant|verb",
  "hullabaloo|HUL-uh-buh-loo|noun",
  "impetuous|im-PECH-oo-us|adjective",
  "jargon|JAR-gun|noun",
  "kerfuffle|ker-FUF-ul|noun",
  "lucid|LOO-sid|adjective",
  "mercurial|mer-KYOOR-ee-ul|adjective",
  "nomenclature|NOH-mun-klay-cher|noun",
  "vigilant|VIJ-uh-lunt|adjective",
  "persnickety|per-SNIK-i-tee|adjective",
  "quibble|KWIB-ul|verb",
  "ruminate|ROO-mi-nayt|verb",
  "scintilla|sin-TIL-uh|noun",
  "tintinnabulation|tin-ti-nab-yuh-LAY-shun|noun",
  "euphoria|yoo-FOR-ee-uh|noun",
];

// Day number in the owner's timezone picks the word.
const day = Math.floor(Date.UTC(+now("YYYY"), +now("MM") - 1, +now("DD")) / 86400000);
const [word, respell, wantPos] = WORDS[day % WORDS.length].split("|");

// Fonts are ASCII only: straighten quotes and dashes, drop anything else.
const ascii = (s) =>
  String(s || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

let pos = wantPos;
let definition = "";
let example = "";
try {
  const res = await get("https://api.dictionaryapi.dev/api/v2/entries/en/" + word, { cache: 86400 });
  if (Array.isArray(res)) {
    // First meaning with the intended part of speech, else the first meaning.
    let meaning = null;
    for (const e of res) for (const m of e.meanings || []) if (!meaning && m.partOfSpeech === wantPos) meaning = m;
    if (!meaning && res[0] && res[0].meanings) meaning = res[0].meanings[0];
    if (meaning && meaning.definitions && meaning.definitions[0]) {
      pos = meaning.partOfSpeech || wantPos;
      definition = ascii(meaning.definitions[0].definition);
      const withEx = meaning.definitions.find((d) => d.example);
      example = withEx ? ascii(withEx.example) : "";
    }
  }
} catch (e) {
  console.log("dictionary failed:", e.message);
}
if (!definition) definition = "Definition unavailable right now.";

// Glyph widths (px) of TFT_eSPI fonts 4 and 2 for chars 32-126, so wrapping is by real pixel width.
const W4 = [5,8,8,19,14,21,17,6,8,8,12,10,7,8,7,8,14,14,14,14,14,14,14,14,14,14,7,7,14,9,14,13,25,16,17,18,18,16,15,19,18,6,13,17,13,21,18,19,16,19,17,16,14,18,15,23,15,16,16,9,13,9,12,13,9,14,15,13,15,14,8,15,15,6,6,12,6,22,15,15,15,15,8,12,7,14,12,18,13,13,12,13,13,13,15];
const W2 = [6,3,4,9,8,9,9,3,7,7,8,6,3,6,5,7,8,8,8,8,8,8,8,8,8,8,3,3,6,6,6,8,9,8,8,8,8,8,8,8,8,4,8,8,7,10,8,8,8,8,8,8,8,8,8,10,8,8,8,4,7,4,7,9,5,7,7,7,7,7,6,7,7,4,5,6,4,8,7,8,7,8,6,6,5,7,8,8,6,7,7,5,3,5,8];
const width = (s, w) => [...s].reduce((n, c) => n + (w[c.charCodeAt(0) - 32] || 0), 0);

const MAX_W = 304;
const wrap = (text, maxLines) => {
  const lines = [];
  let line = "";
  for (const w of text.split(" ").filter(Boolean)) {
    const next = line ? line + " " + w : w;
    if (line && width(next, W2) > MAX_W) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && width(last + "...", W2) > MAX_W) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + "...";
  }
  return lines;
};

// The word: font 4 doubled if it fits the width, else font 4 at size 1.
export const word_text = word;
export const word_size = width(word, W4) * 2 <= MAX_W ? 2 : 1;

// Pill with the part of speech, then the respelling beside it.
export const pos_text = pos.toUpperCase();
export const pill_w = pos_text.length * 6 + 14;
export const respell_text = "/ " + respell + " /";
export const respell_x = 8 + pill_w + 10;

// Body: 5 lines between y 132 and 222. Definition gets up to 4, the example what's left.
const LINES = 5;
const defLines = wrap(definition, 4);
const room = LINES - defLines.length;
const exLines = example && room > 0 ? wrap('"' + example + '"', room) : [];
const body = defLines.concat(exLines);
export const l1 = body[0] || "", l2 = body[1] || "", l3 = body[2] || "", l4 = body[3] || "", l5 = body[4] || "";
// Example lines are drawn in the accent colour.
const DEF_C = "#FFFFFF", EX_C = "#8FD3C0";
export const c1 = 0 < defLines.length ? DEF_C : EX_C, c2 = 1 < defLines.length ? DEF_C : EX_C;
export const c3 = 2 < defLines.length ? DEF_C : EX_C, c4 = 3 < defLines.length ? DEF_C : EX_C;
export const c5 = 4 < defLines.length ? DEF_C : EX_C;
export const date = now("ddd DD/MM");
`;

const BG = "#0E1A1F";
const BAR = "#123A3A";
const ACCENT = "#2BB39A";
const MUTED = "#8A9AA4";

const line = (n: number, y: number): RawWireOp => ["text", `{l${n}}`, 8, y, 2, 1, "TL", `{c${n}}`];

const wire: RawWireOp[] = [
  ["fillScreen", BG],
  ["fillRect", 0, 0, 320, 28, BAR],
  ["text", "WORD OF THE DAY", 8, 14, 2, 1, "ML", "#FFFFFF"],
  ["text", "{date}", 312, 14, 2, 1, "MR", "#9FD8CC"],
  // The word, big.
  ["text", "{word_text}", 8, 62, 4, "{word_size}", "ML", "#FFFFFF"],
  // Part of speech pill and respelling.
  ["fillRoundRect", 8, 96, "{pill_w}", 18, 9, ACCENT],
  ["text", "{pos_text}", 15, 105, 1, 1, "ML", BG],
  ["text", "{respell_text}", "{respell_x}", 105, 2, 1, "ML", MUTED],
  ["drawFastHLine", 8, 122, 304, "#24404A"],
  // Definition, then example.
  line(1, 130),
  line(2, 148),
  line(3, 166),
  line(4, 184),
  line(5, 202),
  ["text", "dictionaryapi.dev", 312, 233, 1, 1, "MR", "#56666E"],
];

const template: Template = {
  id: "word-of-the-day",
  name: "Word of the day",
  description: "A vocabulary word each day with its pronunciation, part of speech, definition and an example.",
  apis: ["Free Dictionary"],
  category: "fun",
  dataCode: code,
  rows: rows("word-of-the-day", wire),
  sampleVars: {"c1":"#FFFFFF","c2":"#FFFFFF","c3":"#FFFFFF","c4":"#8FD3C0","c5":"#8FD3C0","date":"Sat 21/11","l1":"Sinful, villainous, criminal, or wicked, especially","l2":"when noteworthy or notorious for such","l3":"characteristics.","l4":"\"Aliens have a nefarious connotation in many","l5":"science fiction books.\"","pill_w":68,"pos_text":"ADJECTIVE","respell_text":"/ ni-FAIR-ee-us /","respell_x":86,"word_size":2,"word_text":"nefarious"},
};

export default template;
