// Checks one template end to end, the way it will run for real:
//   node scripts/check-template.mjs <id> [--tz Australia/Melbourne] [--no-png]
//
// 1. Loads src/lib/templates/catalog/templates/<id>.ts (Node's built-in TypeScript stripping,
//    with "@/..." and extensionless imports resolved here; no dependencies).
// 2. Runs its dataCode through the real runDataCode (src/lib/data/run.ts: QuickJS sandbox,
//    real get() over the network, now() in --tz) and prints the vars as JSON, ready to paste
//    into sampleVars.
// 3. Checks every {placeholder} in the Draw rows is exported by Data and present in sampleVars,
//    and that text (drawString boxes, from the preview's own measurements) neither overlaps other
//    text nor runs off the 320x240 screen, for both the sample and the live vars.
// 4. Renders both with the real preview code in headless Chrome or Edge to
//    <scratch>/<id>.png: left = sampleVars (the gallery preview), right = live vars, 2x scale.
//
// Exit code 1 on errors (load failure, Data error, missing variables). Warnings don't fail.
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// Hide Node's "module type not specified" warning for the .ts files we load.
process.removeAllListeners("warning");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const tzIdx = args.indexOf("--tz");
const timeZone = tzIdx >= 0 ? args[tzIdx + 1] : "Australia/Melbourne";
const wantPng = !args.includes("--no-png");
if (!id) {
  console.error("usage: node scripts/check-template.mjs <id> [--tz Australia/Melbourne] [--no-png]");
  process.exit(2);
}

// Resolve "@/x" to src/x and extensionless .ts imports, like tsconfig/Next do.
registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith("@/")) base = join(src, specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (base && !/\.[cm]?[jt]sx?$/.test(base)) {
      for (const cand of [base + ".ts", base + ".tsx", join(base, "index.ts")]) {
        if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
      }
    }
    if (base && existsSync(base)) return { url: pathToFileURL(base).href, shortCircuit: true };
    return next(specifier, context);
  },
});

const errors = [];
const warnings = [];
const file = join(src, "lib", "templates", "catalog", "templates", `${id}.ts`);
if (!existsSync(file)) {
  console.error(`No such template file: ${file}`);
  process.exit(1);
}

const t = (await import(pathToFileURL(file).href)).default;
const { runDataCode } = await import(pathToFileURL(join(src, "lib", "data", "run.ts")).href);
const { toWireOps } = await import(pathToFileURL(join(src, "lib", "draw", "ops.ts")).href);
const { opBounds } = await import(pathToFileURL(join(src, "lib", "draw", "preview.ts")).href);
const { CATEGORY_IDS } = await import(pathToFileURL(join(src, "lib", "templates", "catalog", "types.ts")).href);

if (!t || typeof t !== "object") errors.push("the file has no default export");
else {
  if (t.id !== id) errors.push(`id "${t.id}" doesn't match the file name "${id}.ts"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) errors.push(`id "${t.id}" isn't kebab-case`);
  if (!CATEGORY_IDS.includes(t.category)) errors.push(`unknown category "${t.category}"`);
  for (const k of ["name", "description", "dataCode"]) if (!t[k]) errors.push(`${k} is empty`);
  if (!t.rows?.length) errors.push("no Draw rows");
  if (/\bsecrets\./.test(t.dataCode ?? "")) errors.push("dataCode uses secrets; templates must use keyless APIs");
}
if (errors.length) finish(true);

// ---- Data
const started = Date.now();
const live = await runDataCode(t.dataCode, { timeZone });
console.log(`Data ran in ${Date.now() - started} ms (tz ${timeZone})`);
if (live.error) errors.push(`Data error: ${live.error}`);
console.log("\nLive vars (paste into sampleVars if they look right):");
console.log(JSON.stringify(sortKeys(live.vars)));

// ---- Variables
const used = new Set();
for (const r of t.rows) for (const v of Object.values(r.args)) if (typeof v === "string") for (const m of v.matchAll(/\{(\w+)\}/g)) used.add(m[1]);
const missingLive = [...used].filter((k) => !(k in live.vars));
const missingSample = [...used].filter((k) => !(k in t.sampleVars));
const unusedSample = Object.keys(t.sampleVars).filter((k) => !used.has(k));
if (!live.error && missingLive.length) errors.push(`Draw uses vars Data doesn't export: ${missingLive.join(", ")}`);
if (missingSample.length) errors.push(`Draw uses vars missing from sampleVars: ${missingSample.join(", ")}`);
if (unusedSample.length) warnings.push(`sampleVars not used by Draw: ${unusedSample.join(", ")}`);

// ---- Layout (text boxes)
function layout(label, vars) {
  const ops = toWireOps(t.rows, vars);
  const boxes = opBounds(ops);
  const texts = [];
  ops.forEach((op, i) => {
    const b = boxes[i];
    if (op[0] !== "drawString" || !b || !String(op[1]).trim()) return;
    const onScreen = b.x < 320 && b.y < 240 && b.x + b.w > 0 && b.y + b.h > 0;
    if (!onScreen) return; // deliberately hidden (moved off screen)
    if (b.x < 0 || b.y < 0 || b.x + b.w > 320 || b.y + b.h > 240) {
      warnings.push(`${label}: text "${op[1]}" runs off screen (x ${b.x}..${b.x + b.w}, y ${b.y}..${b.y + b.h})`);
    }
    texts.push({ s: String(op[1]), b });
  });
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].b, c = texts[j].b;
      if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) {
        warnings.push(`${label}: text "${texts[i].s}" overlaps "${texts[j].s}"`);
      }
    }
  return ops;
}
const sampleOps = layout("sample", t.sampleVars);
const liveOps = live.error ? null : layout("live", live.vars);

// ---- PNG via headless Chrome/Edge, using the real preview renderer
if (wantPng) {
  const browser = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((p) => p && existsSync(p));
  if (!browser) warnings.push("no Chrome/Edge found for the PNG (set CHROME_PATH)");
  else {
    const strip = (rel) =>
      stripTypeScriptTypes(readFileSync(join(src, rel), "utf8"))
        .replace(/^import .*$/gm, "")
        .replace(/^export /gm, "");
    const js = [
      "const SCREEN_WIDTH = 320, SCREEN_HEIGHT = 240;",
      strip("lib/draw/fonts.ts"),
      strip("lib/draw/preview.ts"),
      `const SETS = ${JSON.stringify([sampleOps, liveOps])};`,
      `document.querySelectorAll("canvas").forEach((c, i) => SETS[i] && renderPreview(c.getContext("2d"), SETS[i]));`,
    ].join("\n");
    const outDir = process.env.CHECK_OUT_DIR || join(tmpdir(), "template-check");
    mkdirSync(outDir, { recursive: true });
    const html = join(outDir, `${id}.html`);
    const png = join(outDir, `${id}.png`);
    writeFileSync(
      html,
      `<!doctype html><html><body style="margin:0;background:#333;display:flex;gap:16px">` +
        `<canvas width="320" height="240" style="width:640px;height:480px;image-rendering:pixelated"></canvas>` +
        `<canvas width="320" height="240" style="width:640px;height:480px;image-rendering:pixelated"></canvas>` +
        `<script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    );
    try {
      execFileSync(
        browser,
        ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1296,480", `--screenshot=${png}`, pathToFileURL(html).href],
        { stdio: "ignore", timeout: 60000 },
      );
      console.log(`\nPreview: ${png}  (left: sampleVars, right: live vars)`);
    } catch (e) {
      warnings.push(`headless screenshot failed: ${e.message}`);
    }
  }
}

finish();

function sortKeys(o) {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}

// Sets the exit code rather than calling process.exit() once fetches have run: exiting with
// keep-alive sockets open trips a libuv assertion on Windows.
function finish(now = false) {
  for (const w of warnings) console.log(`WARN  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(errors.length ? `\n${id}: FAILED` : `\n${id}: OK${warnings.length ? " (check the warnings)" : ""}`);
  process.exitCode = errors.length ? 1 : 0;
  if (now) process.exit();
}
