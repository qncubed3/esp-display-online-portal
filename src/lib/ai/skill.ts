// Builds the "AI helper" prompts: Claude-skill-style Markdown documents that teach an AI how to
// write a Service's Data section and/or Draw ops for this platform.
//
// - buildAiSkill(): full service (Data JS + Draw JSON).
// - buildDrawSkill(vars): Draw/layout only, seeded with the Service's current variables.
//
// The Draw reference is generated from OPS so it stays in sync when ops change.
// The Data limits mirror the constants in src/lib/data/run.ts (not imported, because that
// module pulls in the QuickJS sandbox and this one is used client-side). Keep them in sync.

import { DATUMS, OPS, SCREEN_HEIGHT, SCREEN_WIDTH, SWATCHES, type Field, type OpDef } from "@/lib/draw/ops";
import { formatWire, rowsToWire } from "@/lib/draw/wire";

const DATA_LIMITS = {
  cpuMs: 2000,
  wallS: 15,
  memoryMb: 32,
  fetchTimeoutS: 5,
  maxBodyMb: 1,
  defaultCacheS: 30,
  maxGets: 20,
  defaultTimezone: "Australia/Melbourne",
  pollS: 30,
};

const FENCE = "```";
const W = SCREEN_WIDTH;
const H = SCREEN_HEIGHT;

function fieldType(f: Field): string {
  switch (f.type) {
    case "int":
      return "integer";
    case "color":
      return f.optional ? '"#RRGGBB" or ""' : '"#RRGGBB"';
    case "text":
      return "string";
    case "select":
      return (f.options ?? []).map((o) => JSON.stringify(o.value)).join(" | ");
  }
}

function opSection(def: OpDef): string {
  const sig = `["${def.op}", ${def.fields.map((f) => (f.optional ? `${f.key}?` : f.key)).join(", ")}]`;
  const example = formatWire(rowsToWire([{ id: "", op: def.op, args: Object.fromEntries(def.fields.map((f) => [f.key, f.default])) }]))
    .replace(/^\[\n {2}/, "")
    .replace(/\n\]$/, "");
  const args = def.fields.map((f, i) => {
    const labels = f.type === "select" && f.options?.some((o) => o.label !== String(o.value)) ? ` (${f.options.map((o) => o.label).join(", ")})` : "";
    const opt = f.optional ? `; optional, default omitted` : `; default ${JSON.stringify(f.default)}`;
    return `${i + 1}. \`${f.key}\`: ${fieldType(f)}. ${f.label}${labels}${opt}`;
  });
  return [`#### \`${def.op}\` (${def.label})`, "", `\`${sig}\`, e.g. \`${example}\``, "", ...args].join("\n");
}

// The Draw contract, shared by both skills. `h` is the heading level for its top section.
function drawContract(h: string): string {
  const groups = ["Screen", "Shapes", "Text"] as const;
  const opsReference = groups
    .map((g) => [`${h}## ${g}`, "", ...OPS.filter((d) => d.group === g).map(opSection)].join("\n\n"))
    .join("\n\n");
  const swatches = SWATCHES.map((s) => `${s.name} \`${s.hex}\``).join(", ");

  return `${h} Draw ops contract

Draw is a JSON **array of ops**. Each op is a positional array \`["opName", arg1, arg2, ...]\` with the args in **TFT_eSPI argument order** (listed below). This is exactly the JSON sent to the device, before \`{var}\` substitution. Example:

${FENCE}json
[
  ["fillScreen", "#000000"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "Hello {name}", 8, 8, 2]
]
${FENCE}

Ops run in order, top to bottom; later ops paint over earlier ones. Each frame is drawn from scratch, so start with \`fillScreen\`. Unknown ops are rejected. Trailing args may be left off and take their defaults; at most the listed number of args.

Value rules:

- Any arg may be a string containing \`{name}\` placeholders, replaced by Data variables before drawing (\`"Temp: {temp}"\`, \`"{tempColor}"\`, \`"{barW}"\`). Unknown names become \`""\`.
- Integer args are numbers, or a \`"{var}"\` string that becomes a number after substitution (rounded; non-numbers become 0).
- Colours are \`"#RRGGBB"\` strings (or a \`"{var}"\` holding one). An invalid colour makes that op draw nothing.
- There are **no loops, conditions or expressions**. Logic lives in the Data section, which exports ready-to-use values: a colour, a width, a position, or an empty string. To hide something: a \`drawString\` whose text is \`"{alert}"\` with alert \`""\`, a \`fillRect\` whose width is \`"{barW}"\` with barW 0, or a shape whose colour variable equals the background.
- Coordinates are pixels: x 0-${W - 1}, y 0-${H - 1}, origin top-left. Anything outside is clipped.

Text state is **sticky, like TFT_eSPI**: \`setTextColor\`, \`setTextSize\` and \`setTextDatum\` affect every later \`drawString\` until changed. Initial state: white text, transparent background, size 1, datum \`"TL"\`.

- \`setTextColor\` with only \`fg\` draws transparent-background text. With \`bg\` (different from \`fg\`), the text box is filled with \`bg\` first, which is handy for labels on bars.
- \`setTextDatum\` sets which point of the text's box sits at \`(x, y)\`: first letter T/M/B = top/middle/bottom, second letter L/C/R = left/centre/right. Values: ${DATUMS.map((d) => `\`"${d}"\``).join(" ")}. Use \`"TC"\`/\`"MC"\` with \`x = ${W / 2}\` to centre text, \`"TR"\`/\`"MR"\` with \`x = ${W - 8}\` to right-align, \`"ML"\` to vertically centre a label in a bar.
- \`setTextSize\` (1-7) is an integer multiplier on the font's pixels.

Fonts (\`drawString\`'s last arg), size at text size 1 (multiply by \`setTextSize\`):

| font | height | character width | use |
| --- | --- | --- | --- |
| 1 | 8 px | 6 px, fixed width | small pixel text; size 2 = 12x16, size 3 = 18x24 per char |
| 2 | 16 px | proportional, about 7-9 px average | labels and body text |
| 4 | 26 px | proportional, about 12-15 px average (digits about 14 px) | headings, big numbers |

${h}# Layout tips

- Width estimate: font 1 is exactly \`6 x chars x size\`; for fonts 2 and 4 use the averages and leave slack. A full-width line holds about 53 chars of font 1 size 1, 38 of font 2, 22 of font 4.
- Keep an 8 px margin from the edges and 4-8 px between elements. Line pitch: font 2 about 20 px, font 4 about 30 px (at size 1).
- Structure: a header bar (\`fillRect 0,0,${W},28\` in a dark accent with a font 2 title), content rows or \`fillRoundRect\` cards, optional footer bar (e.g. y ${H - 20}-${H - 1}) for an "updated {time}" line. \`drawFastHLine\` makes cheap dividers.
- Contrast: dark background (#000000 to a dark navy/grey), light text, one or two accent colours for status. Avoid mid-grey text on mid-grey fills; RGB565 quantises subtle shades.
- Big numbers: font 4 size 2 is 52 px tall; font 1 at size 4-6 gives a blocky retro look.
- Use printable ASCII in text; symbols like the degree sign may not render in fonts 2 and 4.
- Long values can overflow: keep text short or let Data truncate it.
- Named colours: ${swatches}.

${h}# Ops reference (arg order matters)

${opsReference}`;
}

export function buildAiSkill(): string {
  const L = DATA_LIMITS;

  return `---
name: esp-display-service
description: Write the Data section (sandboxed JavaScript) and Draw ops (JSON TFT drawing commands) for an ESP Display portal Service, which shows API data on a ${W}x${H} ESP32 colour screen.
---

# ESP Display service builder

Help the user build one **Service** for the ESP Display portal. You produce two things:

1. **Data section**: a small JavaScript module that fetches the user's APIs and exports variables.
2. **Draw ops**: a JSON array of drawing commands that paint a ${W}x${H} screen, using those variables.

## The platform

- The device is an ESP32 with a **${W}x${H} colour TFT** (landscape, origin top-left, x right, y down). Colours are 16-bit on the panel (RGB565).
- The device polls the server about every **${L.pollS} seconds**. Each poll the server runs the Data section, substitutes its variables into the Draw ops and sends the result to the device.
- Draw ops are **TFT_eSPI calls played in order**.
- If the Data section throws (or a \`get\` fails without being caught), the device shows a red "DATA ERROR" screen instead of the Draw ops. Catch errors you can recover from.

## Data section contract

The code runs as an **ES module** in a QuickJS sandbox on the server (not Node, not a browser).

Available:

- \`await get(url, { cache })\`: HTTP **GET only**. Returns the body parsed as JSON, or the raw text if it is not valid JSON.
  - Only \`http:\`/\`https:\` URLs. **No custom headers, no POST, no body**: API keys must go in the query string, read from \`secrets\` (below).
  - \`cache\` is in seconds (default **${L.defaultCacheS}**). Responses are cached per URL and shared between runs; \`cache: 0\` always refetches. Use a longer cache for slow-changing data (e.g. \`{ cache: 600 }\` for a daily forecast).
  - **Throws** on a non-2xx status (\`get <url>: HTTP 404\`), after **${L.fetchTimeoutS}s** (\`timed out\`), or if the body is over **${L.maxBodyMb} MB**.
  - At most **${L.maxGets} \`get\` calls per run**. Calls can run in parallel with \`Promise.all\`.
- \`secrets.NAME\`: the Service owner's secrets (API keys), a read-only object of strings. A name the owner has not created is \`undefined\`. Names are uppercase \`A-Z\`, \`0-9\`, \`_\`, starting with a letter (e.g. \`WEATHER_KEY\`). The user creates them on the portal's **Secrets** page. Secret values are redacted from error messages and variables.
- \`now(format)\`: current time as a string, in the **Service owner's timezone** (set on the portal's **Settings** page; default **${L.defaultTimezone}**). Tokens: \`YYYY\` \`MM\` \`DD\` \`HH\` (00-23) \`mm\` \`ss\` \`ddd\` (Mon, Tue, ...); anything else is kept literally. Default \`"HH:mm"\`. Example: \`now("ddd DD/MM HH:mm")\` gives \`"Fri 20/11 14:05"\`.
- \`console.log(...)\` (also \`info\`, \`warn\`, \`error\`): server log only.
- Standard JavaScript built-ins (\`JSON\`, \`Math\`, \`Date\`, \`Array\`, string methods, \`async\`/\`await\`, top-level \`await\`).

Not available: \`fetch\`, \`require\`/\`import\`, \`setTimeout\`/\`setInterval\`, the filesystem, \`process\`, DOM APIs. \`Date\`/\`toLocale*\` may not know the user's timezone: use \`now()\` for display times.

**API keys: never paste a key into the code.** Always read it from \`secrets.NAME\` and build the URL with \`encodeURIComponent(secrets.NAME)\`. Check it exists first and fail with a clear message, e.g. \`if (!secrets.WEATHER_KEY) throw new Error("Add a WEATHER_KEY secret on the Secrets page")\`. If the user pastes a key into the chat, do not put it in the code: tell them to save it as a secret instead.

Output:

- Every \`export const name = value\` (or \`export { name }\`) whose value is a **string, number or boolean** becomes the variable \`{name}\` in Draw. Objects, arrays, \`null\`, \`undefined\`, \`NaN\` and \`Infinity\` are dropped.
- Use identifier names (letters, digits, \`_\`): Draw only substitutes \`{\\w+}\`.
- Format values for display in Data (rounding, units, padding, truncating) since Draw cannot compute.

Limits: **${L.cpuMs / 1000}s of CPU**, **${L.wallS}s** total including network waits, **${L.memoryMb} MB** memory. Code that never settles is an error.

Example with a fallback for a flaky API:

${FENCE}js
let price = "--";
try {
  const r = await get("https://example.com/api/price?key=" + encodeURIComponent(secrets.PRICE_KEY), { cache: 60 });
  price = "$" + r.price.toFixed(2);
} catch (e) {
  console.log("price failed", e.message);
}
export { price };
export const updated = now("HH:mm");
${FENCE}

${drawContract("##")}

## What to ask the user

Before writing code, make sure you know (ask briefly for anything missing):

1. **The APIs**: URLs plus a **sample JSON response** or docs link, so you read the right fields. For keys, ask only which secret names they have (or will create), never the key itself. If an API needs headers or POST, say it cannot be called directly and suggest a proxy or another API.
2. **What to show**: which values, labels and units, and roughly where (one big number, a list, a dashboard of cards...).
3. **Refresh needs**: how fresh each source must be (sets each \`get\`'s \`cache\`) and the API's rate limits.
4. **Look**: colours or theme, and any conditional styling (e.g. red over a threshold).

## Output format

Reply with a one-line summary, then **exactly two fenced code blocks**, in this order:

1. A \`js\` block: the complete Data section. The user pastes it into the Data editor, replacing its contents.
2. A \`json\` block: the complete Draw ops array in the positional form above, one op per line. The user pastes it into the Draw section's JSON editor, replacing its contents.

After the blocks, list each exported variable and what it holds, one short line each. If the code reads any \`secrets.NAME\`, also list each secret the user must create on the **Secrets** page (exact name and what value to paste, e.g. "\`WEATHER_KEY\`: your OpenWeather API key"). No comments inside the JSON.

## Worked example

User: "Show the Melbourne temperature big in the middle and the time at the top. Use https://api.open-meteo.com/v1/forecast?latitude=-37.81&longitude=144.96&current=temperature_2m"

${FENCE}js
let temp = "--";
let tempColor = "#FFFFFF";
try {
  const w = await get("https://api.open-meteo.com/v1/forecast?latitude=-37.81&longitude=144.96&current=temperature_2m", { cache: 300 });
  const t = w.current.temperature_2m;
  temp = Math.round(t) + "C";
  tempColor = t >= 30 ? "#FF6040" : t <= 10 ? "#60B0FF" : "#FFFFFF";
} catch (e) {
  console.log(e.message);
}
export { temp, tempColor };
export const time = now("ddd HH:mm");
${FENCE}

${FENCE}json
[
  ["fillScreen", "#000000"],
  ["fillRoundRect", 8, 8, ${W - 16}, 36, 6, "#1C2A3A"],
  ["setTextDatum", "MC"],
  ["setTextColor", "#D3D3D3"],
  ["drawString", "Melbourne  {time}", ${W / 2}, 26, 2],
  ["setTextColor", "{tempColor}"],
  ["setTextSize", 2],
  ["drawString", "{temp}", ${W / 2}, ${Math.round((44 + H) / 2)}, 4]
]
${FENCE}

Variables: \`temp\` rounded temperature text, \`tempColor\` colour by temperature, \`time\` day and time.
`;
}

function variablesSection(vars: Record<string, string | number | boolean>): string {
  const names = Object.keys(vars).sort();
  if (names.length === 0) {
    return `## This service's variables

The Data section currently exports **no variables**. Use literal text for now, or ask the user which values their Data section will provide (and their names) before using \`{name}\` placeholders.`;
  }
  const show = (v: string | number | boolean) => {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + '..."' : s;
  };
  return `## This service's variables

The Data section currently exports these variables (sample values from its last run). Use them as \`{name}\` placeholders; do not invent other names. Values change every run, so leave room for longer values.

| name | sample value |
| --- | --- |
${names.map((n) => `| \`{${n}}\` | \`${show(vars[n]).replace(/\|/g, "\\|")}\` |`).join("\n")}`;
}

export function buildDrawSkill(vars: Record<string, string | number | boolean>): string {
  return `---
name: esp-display-draw
description: Lay out the Draw ops (JSON TFT drawing commands) for an ESP Display portal Service's ${W}x${H} ESP32 colour screen, from a description of the screen the user wants.
---

# ESP Display screen designer

The user describes a screen; you return the **Draw ops** that paint it. The screen is a **${W}x${H} colour TFT** on an ESP32 (landscape, origin top-left). The ops are TFT_eSPI calls played in order. Values come from the Service's Data section as \`{name}\` variables; you do not write the Data section here.

${variablesSection(vars)}

${drawContract("##")}

## Before you answer

If the request is vague, ask briefly about: what goes where, which variable feeds each value, colours/theme, and how long values can get. Otherwise go straight to the output.

## Output format

Reply with **exactly one** fenced \`json\` code block containing the complete array, one op per line, no comments. The user pastes it into the Draw section's JSON editor, replacing its contents. You may add one short sentence before the block; nothing after it. If something needs a value the Data section does not provide (e.g. a conditional colour), say so in that sentence and name the variable the Data section should export.

## Example

Request: "Header with a title, then a big number in the middle and an updated time at the bottom."

${FENCE}json
[
  ["fillScreen", "#000000"],
  ["fillRect", 0, 0, ${W}, 28, "#000080"],
  ["setTextDatum", "ML"],
  ["setTextColor", "#FFFFFF"],
  ["drawString", "My dashboard", 8, 14, 2],
  ["setTextDatum", "MC"],
  ["setTextSize", 2],
  ["drawString", "{value}", ${W / 2}, ${Math.round((28 + H - 20) / 2)}, 4],
  ["setTextSize", 1],
  ["drawFastHLine", 0, ${H - 20}, ${W}, "#808080"],
  ["setTextColor", "#D3D3D3"],
  ["drawString", "Updated {time}", ${W / 2}, ${H - 10}, 1]
]
${FENCE}
`;
}
