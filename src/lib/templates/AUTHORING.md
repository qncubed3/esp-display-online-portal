# Authoring a template

A template is a ready-made Service: Data code (JS that fetches and computes variables) plus Draw rows (TFT_eSPI-style ops with `{var}` placeholders), drawn on a 320×240 ESP32 screen. Templates appear on `/templates` and in the Load template dialog, grouped by category.

Many agents add templates in parallel, each committing to the same repo. Follow the file and git rules below exactly.

## Files

- Add **exactly one file**: `src/lib/templates/catalog/templates/<id>.ts`, with `export default` a `Template`. Nothing else: no index or list to edit. `scripts/gen-templates.mjs` discovers every file in that folder and writes `catalog/generated.ts`, which is gitignored and must never be committed.
- Keep the file self-contained. Add a shared helper only if you really need one, because other agents are working at the same time.
- Copy the shape of an existing file, such as `templates/clock.ts` (simple) or `templates/weather.ts` (API, icons, cards):

```ts
import type { RawWireOp } from "@/lib/draw/wire";
import { rows } from "../rows";
import type { Template } from "../types";

const code = String.raw`// What this shows and where the data comes from.
const CITY = "Melbourne"; // settings the user may change go at the top, in CAPS
...
export const temp = "21";
`;

const wire: RawWireOp[] = [
  ["fillScreen", "#000000"],
  ["text", "{temp}", 160, 120, 4, 2, "MC", "#FFFFFF"],
];

const template: Template = {
  id: "my-template",
  name: "My template",
  description: "One sentence for the card.",
  apis: ["Open-Meteo"],
  category: "weather",
  dataCode: code,
  rows: rows("my-template", wire),
  sampleVars: { temp: "21" },
};

export default template;
```

## Ids

Use kebab-case (`[a-z0-9-]`), unique, short and descriptive, such as `iss-tracker`, `tides-port-phillip` or `github-trending`. The id **must equal the file name**. `index.ts` throws on a mismatch or a duplicate, so `npm run build` fails. Before you start, check that the name is free: `ls src/lib/templates/catalog/templates/`.

## `Template` fields (`catalog/types.ts`)

| Field | Notes |
| --- | --- |
| `id` | As above. Also the first argument to `rows()`. |
| `name` | Card title, two to four words. |
| `description` | One sentence: what the screen shows. |
| `apis` | Short API names, shown as badges and searchable, e.g. `["Open-Meteo"]`. Use `["now() only"]` if there is no API. |
| `category` | One of `transport`, `weather` (including air quality and tides), `space`, `finance` (crypto, currencies, markets), `news` (news and RSS), `sports`, `clocks` (clocks, calendars, countdowns), `science` (earthquakes, nature, environment), `fun` (quotes, facts, jokes, games), `tech` (GitHub, dev, internet stats), `world` (countries, holidays, population). |
| `dataCode` | The Data JS, as a `String.raw` template literal. It can't contain a backtick or `${`: build strings with `+`. |
| `rows` | `rows("<id>", wire)`, which turns wire ops into rows with stable ids and throws on bad wire. |
| `sampleVars` | **Real** output of `dataCode`, from the checker below. It drives the gallery preview. Include every var that Draw uses. |

## Data contract (`src/lib/data/run.ts`)

The code runs as an ES module in a QuickJS sandbox, so top-level `await` works. It has:

- `await get(url, { cache: seconds })`: GET only. It returns parsed JSON, or text if the body isn't JSON (RSS/XML comes back as text, so parse it with regex; there is no DOMParser). Responses are cached per URL across all users on a warm server. It throws on HTTP errors and timeouts.
- `now(format)`: the current time **in the Service owner's timezone** (default `Australia/Melbourne`). Tokens: `HH mm ss DD MM YYYY ddd`, e.g. `now("ddd DD/MM HH:mm")`.
- `console.log(...)`: goes to the server log.
- There is no `fetch`, timers, DOM, `require` or `import`. **Don't use `secrets`.** Templates must use keyless APIs only, with no key and no sign-up.
- Outputs: every `export const` whose value is a string, a finite number or a boolean becomes a Draw variable. Objects and arrays are dropped, so flatten them (`r1_name`, `r1_score`, …).
- Limits: 2 s of CPU, 15 s wall time, 5 s per fetch, 1 MB per response, 20 `get` calls per run and 32 MB of memory. Keep it to one or two requests where you can.
- Each request is sent with `User-Agent: esp-display-portal`.

**Cache seconds:** choose them to respect the API's rate limit, because every device poll runs the code and all users share the cache. Use about 600 for weather, 60–120 for prices, 3600 for slow-changing data (quotes, holidays, daily facts) and 30–60 for departures. If the API's limit is tight (like CoinGecko's), go higher.

**Make failures graceful:** wrap each `get` in `try/catch`, and fall back to readable strings such as `"No data"` or `"--"`. Hide the parts that don't apply. A Data error stops the whole screen updating.

## Draw (`src/lib/draw/ops.ts`)

- The screen is **320×240** with (0,0) at the top left. Colours are `"#RRGGBB"`; the device uses RGB565, so subtle shades merge.
- Ops in wire form: `fillScreen, drawPixel, drawLine, drawFastHLine, drawFastVLine, drawRect, fillRect, drawRoundRect, fillRoundRect, drawCircle, fillCircle, drawTriangle, fillTriangle`, and for text the composite **`text`** op (prefer it):
  `["text", text, x, y, font, size, datum, fg, bg?]`. The datum is the anchor: `TL TC TR ML MC MR BL BC BR`. Leave out `bg` for transparent text. (The older templates use `setTextColor`/`setTextSize`/`setTextDatum`/`drawString`; those still work.)
- Any argument can be a `"{var}"` string, including numbers such as `x`, `y` and `w`. Unknown vars become `""`, or 0 for numbers.
- Fonts (sizes before the `size` multiplier, which runs 1–7):
  - **Font 1**: a 6×8 px cell (each character is 6 px wide). It suits small labels.
  - **Font 2**: 16 px tall, with variable width (about 5–10 px per character, about 7 on average).
  - **Font 4**: 26 px tall, with variable width (about 14 px per digit).
  - Exact widths are in `src/lib/draw/fonts.ts` (`FONT2.widths` / `FONT4.widths`, indexed by char code − 32). The fonts are **ASCII only**, so replace curly quotes, dashes and accents in Data.
- Text doesn't wrap or clip. Wrap and truncate in Data (see `templates/quote.ts`), and measure the longest realistic value.
- **Draw has no conditions.** Control what shows from Data: return `""` to hide text, or return an off-screen coordinate (for example `y = -200`) for shapes. Don't paint shapes in the background colour, because that erases whatever they overlap. Colours can be vars too, for example green when a value is up and red when it's down.
- Rows draw in order. Start with `fillScreen`; later rows paint over earlier ones.

## Design guidelines

- Add a **header bar** (for example a `fillRect` 0,0,320,24–32 in a dark tint) with the title or place on the left and `now("HH:mm")` or the date on the right.
- Keep text readable: font 2 or font 4 for values, and font 1 only for labels and small print. Put the key number big (font 4 at size 1–3).
- Use a consistent palette: a dark background, one accent colour, white or light-grey text, and muted grey for labels. Keep good contrast; avoid dark blue text on black.
- Leave margins of at least 6–8 px from the screen edges, and align items to a grid.
- `sampleVars` should look realistic, because they are what people see in the gallery.
- Credit the source in small print if its terms ask for it (ZenQuotes does, for example).

## Verification checklist

1. **Curl the API** and build on the real response shape: `curl -s "<url>" | head -c 2000`. Check that it works without a key and look at its rate limit.
2. Run **`npm run gen:templates`**. `generated.ts` is gitignored, so `tsc` and the checker need it on a fresh clone.
3. Run the **checker**, which uses the real `runDataCode` and the real preview renderer:
   `node scripts/check-template.mjs <id>` (or `npm run check:template -- <id>`). It needs network access.
   - It prints the live vars as JSON. If they look right, **paste them into `sampleVars`**.
   - It fails on Data errors, Draw vars that Data doesn't export, or vars missing from `sampleVars`.
   - It warns about text that overlaps other text or runs off the 320×240 screen. Fix those, unless the overlap is deliberate (a shadow, for example).
   - It writes a PNG (left: `sampleVars`, right: live data, at 2× scale) using headless Chrome or Edge, and prints the path. **Open the PNG and look at it**: check alignment, readability, nothing clipped and nothing overlapping. Set `CHECK_OUT_DIR` to choose where it goes, and `--tz Europe/London` to try another timezone.
   - Also try the empty or error case once, for example by pointing at a bad URL temporarily, and make sure the screen still looks sensible.
4. Run **`npx tsc --noEmit`**. It must pass.
5. **Commit only your file:**
   ```
   git add src/lib/templates/catalog/templates/<id>.ts
   git commit -m "Add <name> template"
   git push
   ```
   - If git says `index.lock` exists, another agent is committing: wait a second and retry, up to about 10 times.
   - If the push is rejected: `git pull --rebase`, then `git push`.
   - **Never** use `git add -A`, `git add .`, `git stash`, `git reset --hard` or a force-push, and never edit, stage or revert other agents' files.
