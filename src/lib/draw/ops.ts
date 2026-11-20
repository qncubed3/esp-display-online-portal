// The Draw section's command catalogue. Shared contract for:
// - the Draw editor UI (one row per command, fields rendered from `fields`)
// - the browser preview (plays WireOps on a canvas)
// - the device endpoint (turns saved rows into WireOps for the ESP32)
//
// Field order = TFT_eSPI argument order, so a WireOp is `[op, ...fieldValues]`.

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 240;

export type FieldType = "int" | "color" | "text" | "select";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  default: string | number;
  options?: { value: string | number; label: string }[]; // for "select"
  optional?: boolean; // trailing optional arg: an empty value is left off the WireOp
}

export interface OpDef {
  op: string; // TFT_eSPI method name, sent to the device as-is
  label: string;
  group: "Screen" | "Shapes" | "Text";
  fields: Field[];
}

// One row in the Draw editor, as stored in services.draw_ops.
// Any value may be a string containing {varName}; it is filled from the Data section's variables.
export interface DrawRow {
  id: string;
  op: string;
  args: Record<string, string | number>;
}

export type WireOp = [string, ...(string | number)[]];

// What the device endpoint returns.
export interface Frame {
  v: 1;
  id: string; // hash of ops; the device sends it back as ?since=
  next: number; // seconds until the next poll
  ops: WireOp[];
}

const x = (d = 0): Field => ({ key: "x", label: "X", type: "int", default: d });
const y = (d = 0): Field => ({ key: "y", label: "Y", type: "int", default: d });
const w = (d = 50): Field => ({ key: "w", label: "Width", type: "int", default: d });
const h = (d = 30): Field => ({ key: "h", label: "Height", type: "int", default: d });
const r = (d = 10): Field => ({ key: "r", label: "Radius", type: "int", default: d });
const color = (key = "color", label = "Colour", d = "#FFFFFF"): Field => ({ key, label, type: "color", default: d });
const pt = (n: number, dx: number, dy: number): Field[] => [
  { key: `x${n}`, label: `X${n}`, type: "int", default: dx },
  { key: `y${n}`, label: `Y${n}`, type: "int", default: dy },
];

export const DATUMS = ["TL", "TC", "TR", "ML", "MC", "MR", "BL", "BC", "BR"] as const;

export const OPS: OpDef[] = [
  { op: "fillScreen", label: "Fill screen", group: "Screen", fields: [color("color", "Colour", "#000000")] },

  { op: "drawPixel", label: "Pixel", group: "Shapes", fields: [x(), y(), color()] },
  { op: "drawLine", label: "Line", group: "Shapes", fields: [...pt(0, 0, 0), ...pt(1, 50, 50), color()] },
  { op: "drawFastHLine", label: "Horizontal line", group: "Shapes", fields: [x(), y(), w(320), color()] },
  { op: "drawFastVLine", label: "Vertical line", group: "Shapes", fields: [x(), y(), h(240), color()] },
  { op: "drawRect", label: "Rectangle outline", group: "Shapes", fields: [x(), y(), w(), h(), color()] },
  { op: "fillRect", label: "Rectangle", group: "Shapes", fields: [x(), y(), w(), h(), color()] },
  { op: "drawRoundRect", label: "Rounded rectangle outline", group: "Shapes", fields: [x(), y(), w(), h(), r(6), color()] },
  { op: "fillRoundRect", label: "Rounded rectangle", group: "Shapes", fields: [x(), y(), w(), h(), r(6), color()] },
  { op: "drawCircle", label: "Circle outline", group: "Shapes", fields: [x(160), y(120), r(), color()] },
  { op: "fillCircle", label: "Circle", group: "Shapes", fields: [x(160), y(120), r(), color()] },
  { op: "drawTriangle", label: "Triangle outline", group: "Shapes", fields: [...pt(0, 10, 40), ...pt(1, 30, 10), ...pt(2, 50, 40), color()] },
  { op: "fillTriangle", label: "Triangle", group: "Shapes", fields: [...pt(0, 10, 40), ...pt(1, 30, 10), ...pt(2, 50, 40), color()] },

  {
    op: "setTextColor", label: "Text colour", group: "Text",
    fields: [color("fg", "Text"), { ...color("bg", "Background", ""), optional: true }],
  },
  {
    op: "setTextSize", label: "Text size", group: "Text",
    fields: [{ key: "size", label: "Size", type: "select", default: 1, options: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n}×` })) }],
  },
  {
    op: "setTextDatum", label: "Text anchor", group: "Text",
    fields: [{ key: "datum", label: "Anchor", type: "select", default: "TL", options: DATUMS.map((d) => ({ value: d, label: d })) }],
  },
  {
    op: "drawString", label: "Text", group: "Text",
    fields: [
      { key: "text", label: "Text", type: "text", default: "Hello" },
      x(8), y(8),
      { key: "font", label: "Font", type: "select", default: 1, options: [
        { value: 1, label: "1: small (8px)" }, { value: 2, label: "2: 16px" }, { value: 4, label: "4: 26px" },
      ] },
    ],
  },
];

export const OP_BY_NAME: Record<string, OpDef> = Object.fromEntries(OPS.map((d) => [d.op, d]));

export function newRow(op: string): DrawRow {
  const def = OP_BY_NAME[op];
  return {
    id: crypto.randomUUID(),
    op,
    args: Object.fromEntries(def.fields.map((f) => [f.key, f.default])),
  };
}

// Replace {name} with the variable's value. Unknown names become "".
export function fill(value: string, vars: Record<string, unknown>): string {
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? "" : String(vars[name])));
}

// Saved rows + Data section variables → what the ESP32 (and the preview) draws.
export function toWireOps(rows: DrawRow[], vars: Record<string, unknown>): WireOp[] {
  const out: WireOp[] = [];
  for (const row of rows) {
    const def = OP_BY_NAME[row.op];
    if (!def) continue;
    const args: (string | number)[] = [];
    for (const f of def.fields) {
      let v = row.args[f.key] ?? f.default;
      if (typeof v === "string") v = fill(v, vars);
      if (f.optional && v === "") break;
      if (f.type === "int" || (f.type === "select" && typeof f.default === "number")) v = Math.round(Number(v) || 0);
      args.push(v);
    }
    out.push([def.op, ...args]);
  }
  return out;
}

// Named colours offered as swatches in the editor (TFT_eSPI's constants, as RGB).
export const SWATCHES: { name: string; hex: string }[] = [
  { name: "Black", hex: "#000000" }, { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#000080" }, { name: "Blue", hex: "#0000FF" },
  { name: "Cyan", hex: "#00FFFF" }, { name: "Green", hex: "#00FF00" },
  { name: "Yellow", hex: "#FFFF00" }, { name: "Orange", hex: "#FFA500" },
  { name: "Red", hex: "#FF0000" }, { name: "Magenta", hex: "#FF00FF" },
  { name: "Light grey", hex: "#D3D3D3" }, { name: "Dark grey", hex: "#808080" },
];
