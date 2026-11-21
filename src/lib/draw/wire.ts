// Draw rows <-> the device wire format, *before* variable substitution.
//
// Wire form is what toWireOps() sends to the ESP32 (`[op, ...args]` in TFT_eSPI argument
// order) but with `{var}` placeholders left in. The Draw section's JSON editor shows and
// accepts this form, so pasted AI output and hand edits map straight onto rows.

import { OP_BY_NAME, isEmptyArg, type DrawRow, type Field } from "./ops";

export type RawWireOp = [string, ...(string | number)[]];

const hasVar = (v: string) => /\{\w+\}/.test(v);
const isNumericField = (f: Field) => f.type === "int" || (f.type === "select" && typeof f.default === "number");

// Rows → wire form. Mirrors toWireOps without fill(): optional trailing args that are empty (or at
// their default, e.g. rotation 0) are left off, numeric fields become numbers unless they hold a
// {var} placeholder. The rotation stays a trailing arg here (toWireOps expands it for the device).
export function rowsToWire(rows: DrawRow[]): RawWireOp[] {
  const out: RawWireOp[] = [];
  for (const row of rows) {
    const def = OP_BY_NAME[row.op];
    if (!def) continue;
    const args: (string | number)[] = [];
    for (const f of def.fields) {
      let v = row.args[f.key] ?? f.default;
      if (isNumericField(f) && !(typeof v === "string" && hasVar(v)) && !(f.optional && v === "")) v = Math.round(Number(v)) || 0;
      args.push(v);
    }
    while (args.length && isEmptyArg(def.fields[args.length - 1], args[args.length - 1])) args.pop();
    out.push([def.op, ...args]);
  }
  return out;
}

// One op per line: [\n  ["fillScreen", "#000000"],\n  ...\n]
export function formatWire(ops: RawWireOp[]): string {
  if (ops.length === 0) return "[]";
  return `[\n${ops.map((op) => `  [${op.map((v) => JSON.stringify(v)).join(", ")}]`).join(",\n")}\n]`;
}

export type WireParseResult = { ok: true; rows: DrawRow[] } | { ok: false; error: string };

function checkValue(f: Field, v: unknown): { value: string | number } | { error: string } {
  const name = `"${f.key}"`;
  if (typeof v === "string" && hasVar(v)) return { value: v }; // placeholders are checked at draw time
  switch (f.type) {
    case "int":
      if (typeof v === "number" && Number.isFinite(v)) return { value: Math.round(v) };
      if (typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return { value: Math.round(Number(v)) };
      return { error: `${name} must be a whole number or a "{var}" string, got ${JSON.stringify(v)}` };
    case "color":
      if (typeof v === "string" && (/^#[0-9a-f]{6}$/i.test(v) || (f.optional && v === ""))) return { value: v.toUpperCase() };
      return { error: `${name} must be a "#RRGGBB" colour${f.optional ? ' or ""' : ""}, got ${JSON.stringify(v)}` };
    case "text":
      if (typeof v === "string") return { value: v };
      if (typeof v === "number" && Number.isFinite(v)) return { value: String(v) };
      return { error: `${name} must be a string, got ${JSON.stringify(v)}` };
    case "select": {
      const opts = f.options ?? [];
      const hit = opts.find((o) => o.value === v || (typeof v === "string" && String(o.value).toUpperCase() === v.trim().toUpperCase()));
      if (hit) return { value: hit.value };
      return { error: `${name} must be one of ${opts.map((o) => JSON.stringify(o.value)).join(", ")}, got ${JSON.stringify(v)}` };
    }
  }
}

// Wire form → rows. Row ids are kept by index when the op is unchanged, so editing JSON
// doesn't reset selection in the row UI. Missing trailing args take their defaults.
export function wireToRows(wire: unknown, prevRows: DrawRow[] = []): WireParseResult {
  if (!Array.isArray(wire)) return { ok: false, error: "Expected a JSON array of ops, like [[\"fillScreen\", \"#000000\"]]." };
  const rows: DrawRow[] = [];
  for (let i = 0; i < wire.length; i++) {
    const item = wire[i];
    const at = `Op ${i + 1}`;
    if (!Array.isArray(item) || item.length === 0) {
      return { ok: false, error: `${at}: expected an array like ["op", arg1, arg2, ...], got ${JSON.stringify(item)}` };
    }
    const [op, ...args] = item;
    const def = typeof op === "string" ? OP_BY_NAME[op] : undefined;
    if (!def) return { ok: false, error: `${at}: unknown op ${JSON.stringify(op)}` };
    if (args.length > def.fields.length) {
      return {
        ok: false,
        error: `${at} (${def.op}): takes at most ${def.fields.length} args (${def.fields.map((f) => f.key).join(", ")}), got ${args.length}`,
      };
    }
    const rowArgs: DrawRow["args"] = {};
    for (let j = 0; j < def.fields.length; j++) {
      const f = def.fields[j];
      if (j >= args.length) {
        rowArgs[f.key] = f.default;
        continue;
      }
      const res = checkValue(f, args[j]);
      if ("error" in res) return { ok: false, error: `${at} (${def.op}), arg ${j + 1}: ${res.error}` };
      rowArgs[f.key] = res.value;
    }
    const prev = prevRows[i];
    rows.push({ id: prev && prev.op === def.op ? prev.id : crypto.randomUUID(), op: def.op, args: rowArgs });
  }
  return { ok: true, rows };
}

// Parse editor text. Tolerates a surrounding ```json fence, as pasted from an AI chat.
export function parseWireText(text: string, prevRows: DrawRow[] = []): WireParseResult {
  const src = text.trim().replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
  if (!src) return { ok: true, rows: [] };
  let data: unknown;
  try {
    data = JSON.parse(src);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  return wireToRows(data, prevRows);
}
