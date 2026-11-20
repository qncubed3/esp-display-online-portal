"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, Copy, GripVertical, Trash2 } from "lucide-react";
import { OPS, OP_BY_NAME, SWATCHES, newRow, type DrawRow, type Field } from "@/lib/draw/ops";

export interface DrawEditorProps {
  rows: DrawRow[];
  onChange(rows: DrawRow[]): void;
  variables: string[];
  selectedId: string | null;
  onSelect(id: string | null): void;
}

const GROUPS = ["Screen", "Shapes", "Text"] as const;

const inputCls =
  "h-7 rounded-md border border-[#2e2e2e] bg-[#161616] px-2 text-[13px] text-[#ededed] outline-none placeholder:text-[#5a5a5a] hover:border-[#3e3e3e] focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/30";
const iconBtnCls =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#a0a0a0] outline-none hover:bg-[#2a2a2a] hover:text-[#ededed] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]";

// Native select with a custom chevron. h-7 (28px) and a 14px icon leave 7px above and below it,
// so the icon sits 7px from the right edge too; pr-7 keeps the text clear of it.
export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      <select {...rest} className={`${inputCls} w-full cursor-pointer appearance-none pr-7`}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-[7px] top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function OpSelect({ value, onChange, className = "", label }: { value: string; onChange(op: string): void; className?: string; label: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {OPS.filter((d) => d.group === g).map((d) => (
            <option key={d.op} value={d.op}>
              {d.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

// Integer field: accepts numbers or text containing {var}.
function IntInput({
  field,
  value,
  onChange,
  className,
}: {
  field: Field;
  value: string | number;
  onChange(v: string | number): void;
  className?: string; // replaces the default width
}) {
  const str = String(value ?? "");
  const isVar = /[{}]/.test(str);
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={field.label}
      title={field.label}
      value={str}
      onChange={(e) => {
        const t = e.target.value;
        onChange(/^-?\d+$/.test(t) ? Number(t) : t);
      }}
      onKeyDown={(e) => {
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.altKey && /^-?\d*$/.test(str)) {
          e.preventDefault();
          const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
          onChange((Number(str) || 0) + step);
        }
      }}
      className={`${inputCls} ${className ?? (isVar ? "w-28" : "w-14")} ${isVar ? "text-[#3ecf8e]" : ""} tabular-nums`}
    />
  );
}

// `compact`: swatch-only button (name in the tooltip), popover opens to the left; used on the card's first line.
function ColorInput({
  field,
  value,
  onChange,
  compact,
}: {
  field: Field;
  value: string | number;
  onChange(v: string): void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const str = String(value ?? "");
  const isHex = /^#[0-9a-f]{6}$/i.test(str);
  const none = str === "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const name = SWATCHES.find((s) => s.hex.toLowerCase() === str.toLowerCase())?.name;

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={`${field.label}: ${none ? "none" : name ?? str}`}
        title={`${field.label}: ${none ? "none" : name ?? str}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#161616] text-[12px] text-[#a0a0a0] outline-none hover:border-[#3e3e3e] focus-visible:border-[#3ecf8e] ${
          compact ? "w-7 justify-center" : "px-1.5"
        }`}
      >
        <span
          className="h-4 w-4 rounded-sm border border-[#3e3e3e]"
          style={
            none
              ? { background: "repeating-conic-gradient(#3a3a3a 0% 25%, #1c1c1c 0% 50%) 0 0 / 6px 6px" }
              : { background: isHex ? str : "#2a2a2a" }
          }
        />
        {!compact && <span className="max-w-[72px] truncate">{none ? "none" : name ?? str}</span>}
      </button>
      {open && (
        <div
          className={`absolute ${compact ? "right-0" : "left-0"} top-8 z-30 w-[188px] rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-2 shadow-xl`}
        >
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[#a0a0a0]">{field.label}</div>
          <div className="grid grid-cols-6 gap-1">
            {SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                title={s.name}
                aria-label={s.name}
                onClick={() => {
                  onChange(s.hex);
                  setOpen(false);
                }}
                className={`h-6 w-6 rounded-sm border outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e] ${
                  s.hex.toLowerCase() === str.toLowerCase() ? "border-[#3ecf8e]" : "border-[#3e3e3e]"
                }`}
                style={{ background: s.hex }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="color"
              aria-label="Pick colour"
              value={isHex ? str : "#000000"}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="h-7 w-8 cursor-pointer rounded-md border border-[#2e2e2e] bg-[#161616] p-0.5"
            />
            <input
              type="text"
              aria-label="Hex colour or {variable}"
              value={str}
              placeholder="#RRGGBB"
              onChange={(e) => onChange(e.target.value)}
              className={`${inputCls} w-full font-mono`}
            />
          </div>
          {field.optional && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`mt-2 w-full rounded-md border px-2 py-1 text-left text-[12px] outline-none hover:bg-[#2a2a2a] focus-visible:border-[#3ecf8e] ${
                none ? "border-[#3ecf8e] text-[#ededed]" : "border-[#2e2e2e] text-[#a0a0a0]"
              }`}
            >
              None (transparent)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TextInput({ field, value, onChange, variables }: { field: Field; value: string | number; onChange(v: string): void; variables: string[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const str = String(value ?? "");

  const insert = (name: string) => {
    const el = ref.current;
    const token = `{${name}}`;
    const start = el?.selectionStart ?? str.length;
    const end = el?.selectionEnd ?? str.length;
    onChange(str.slice(0, start) + token + str.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <input
        ref={ref}
        type="text"
        aria-label={field.label}
        value={str}
        placeholder={field.label}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} min-w-[120px] flex-1 rounded-r-none`}
      />
      <select
        aria-label="Insert variable"
        title={variables.length ? "Insert variable" : "No variables (define them in the Data section)"}
        value=""
        disabled={!variables.length}
        onChange={(e) => {
          if (e.target.value) insert(e.target.value);
        }}
        className="h-7 w-9 cursor-pointer appearance-none rounded-r-md border border-l-0 border-[#2e2e2e] bg-[#232323] text-center font-mono text-[12px] text-[#3ecf8e] outline-none hover:bg-[#2a2a2a] focus:border-[#3ecf8e] disabled:cursor-not-allowed disabled:text-[#5a5a5a]"
      >
        <option value="">{"{ }"}</option>
        {variables.map((v) => (
          <option key={v} value={v}>
            {`{${v}}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectInput({
  field,
  value,
  onChange,
  className,
}: {
  field: Field;
  value: string | number;
  onChange(v: string | number): void;
  className?: string;
}) {
  const opts = field.options ?? [];
  const str = String(value ?? "");
  const known = opts.some((o) => String(o.value) === str);
  return (
    <Select
      aria-label={field.label}
      title={field.label}
      className={className}
      value={str}
      onChange={(e) => {
        const o = opts.find((o) => String(o.value) === e.target.value);
        onChange(o ? o.value : e.target.value);
      }}
    >
      {!known && <option value={str}>{str || "—"}</option>}
      {opts.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function FieldInput(props: { field: Field; value: string | number; onChange(v: string | number): void; variables: string[] }) {
  const { field } = props;
  const p = props;
  const input =
    field.type === "int" ? (
      <IntInput {...p} />
    ) : field.type === "color" ? (
      <ColorInput {...p} />
    ) : field.type === "select" ? (
      <SelectInput {...p} />
    ) : (
      <TextInput {...p} />
    );
  return (
    <div
      className={`flex items-center gap-1 ${
        field.type === "text" ? "min-w-[180px] flex-1" : "shrink-0"
      }`}
    >
      {field.type !== "text" && <span className="text-[11px] text-[#a0a0a0]">{field.label.replace(/^(Width|Height|Radius)$/, (m) => m[0])}</span>}
      {input}
    </div>
  );
}

// Params layout: each line is a short label then up to three fields in fixed grid columns, so X fields
// line up under X fields, Y under Y, and the extra column (radius, font...) under itself across lines.
// A line with `span` lets its field fill the rest of the line. Colour fields go on the card's first line
// instead; any field not placed here falls back to the plain wrapping row below the grid.
type ParamLine = { label: string; keys: string[]; span?: boolean };
const POS: ParamLine = { label: "Position", keys: ["x", "y"] };
const RECT: ParamLine[] = [POS, { label: "Size", keys: ["w", "h"] }];
const ROUND_RECT: ParamLine[] = [POS, { label: "Size", keys: ["w", "h", "r"] }];
const CIRCLE: ParamLine[] = [{ label: "Centre", keys: ["x", "y", "r"] }];
const TRIANGLE: ParamLine[] = [
  { label: "Point 1", keys: ["x0", "y0"] },
  { label: "Point 2", keys: ["x1", "y1"] },
  { label: "Point 3", keys: ["x2", "y2"] },
];
const LAYOUT: Record<string, ParamLine[]> = {
  drawPixel: [POS],
  drawLine: [
    { label: "Start", keys: ["x0", "y0"] },
    { label: "End", keys: ["x1", "y1"] },
  ],
  drawFastHLine: [POS, { label: "Length", keys: ["w"] }],
  drawFastVLine: [POS, { label: "Length", keys: ["h"] }],
  drawRect: RECT,
  fillRect: RECT,
  drawRoundRect: ROUND_RECT,
  fillRoundRect: ROUND_RECT,
  drawCircle: CIRCLE,
  fillCircle: CIRCLE,
  drawTriangle: TRIANGLE,
  fillTriangle: TRIANGLE,
  drawString: [
    { label: "Text", keys: ["text"], span: true },
    { label: "Position", keys: ["x", "y", "font"] },
  ],
  text: [
    { label: "Text", keys: ["text"], span: true },
    { label: "Position", keys: ["x", "y", "datum"] },
    { label: "Style", keys: ["font", "size"] },
  ],
};

// "X0" -> "X", "Width" -> "W", "Radius" -> "R".
const prefixOf = (f: Field) => f.label.replace(/\d+$/, "").charAt(0).toUpperCase();

// One field in the params grid. col: 1 = X column, 2 = Y column, 3 = extra column.
function GridField(props: {
  field: Field;
  value: string | number;
  onChange(v: string | number): void;
  variables: string[];
  span?: boolean;
  col: number;
}) {
  const { field, value, onChange, variables, span, col } = props;
  if (field.type === "text" || span) {
    return (
      <div className="col-[2/-1] flex min-w-0">
        <FieldInput field={field} value={value} onChange={onChange} variables={variables} />
      </div>
    );
  }
  if (field.type === "int") {
    // X/Y columns fill their cell; the extra column gets the same width, left-aligned.
    return (
      <div className={`relative min-w-0 ${col === 3 ? "w-[84px] justify-self-start" : ""}`}>
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#5a5a5a]">{prefixOf(field)}</span>
        <IntInput field={field} value={value} onChange={onChange} className="w-full pl-6" />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className={`min-w-0 ${col === 3 ? "justify-self-start" : ""}`}>
        <SelectInput field={field} value={value} onChange={onChange} />
      </div>
    );
  }
  return <FieldInput field={field} value={value} onChange={onChange} variables={variables} />;
}

// Changing type: new op's defaults, keeping values whose keys match.
function changeOp(row: DrawRow, op: string): DrawRow {
  const fresh = newRow(op);
  const def = OP_BY_NAME[op];
  const args: DrawRow["args"] = { ...fresh.args };
  for (const f of def.fields) if (f.key in row.args) args[f.key] = row.args[f.key];
  return { ...row, op, args };
}

export default function DrawEditor({ rows, onChange, variables, selectedId: sel, onSelect: select }: DrawEditorProps) {
  const [armed, setArmed] = useState<string | null>(null); // row whose handle is pressed
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null); // insert-before index
  const listRef = useRef<HTMLOListElement>(null);

  const update = (id: string, fn: (r: DrawRow) => DrawRow) => onChange(rows.map((r) => (r.id === id ? fn(r) : r)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = rows.slice();
    const [r] = next.splice(from, 1);
    next.splice(to, 0, r);
    onChange(next);
  };

  const focusRow = (id: string) =>
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-row-id="${id}"] [data-handle]`)?.focus());

  const duplicate = (i: number) => {
    const copy: DrawRow = { ...rows[i], id: crypto.randomUUID(), args: { ...rows[i].args } };
    const next = rows.slice();
    next.splice(i + 1, 0, copy);
    onChange(next);
    select(copy.id);
  };

  const remove = (i: number) => {
    const id = rows[i].id;
    onChange(rows.filter((r) => r.id !== id));
    const neighbour = rows[i + 1] ?? rows[i - 1];
    if (sel === id) select(neighbour?.id ?? null);
    if (neighbour) focusRow(neighbour.id);
  };

  const onRowKey = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const to = i + (e.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= rows.length) return;
    const id = rows[i].id;
    move(i, to);
    focusRow(id);
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>, i: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
  };

  const endDrag = () => {
    setDragId(null);
    setDropAt(null);
    setArmed(null);
  };

  // Handled on the list so a drop in the gap between cards still lands.
  const onDrop = (e: DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    if (dropAt != null) {
      const from = rows.findIndex((r) => r.id === dragId);
      if (from >= 0) move(from, dropAt > from ? dropAt - 1 : dropAt);
    }
    endDrag();
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
        No draw commands yet. Pick a type above and click Add row. Rows run top to bottom, like the device draws them.
      </div>
    );
  }

  // Drop indicator: a glowing line in the middle of the 8px gap between cards.
  const indicator = (pos: "top" | "bottom") => (
    <div
      className={`pointer-events-none absolute -left-px -right-px h-[2px] rounded-full bg-accent shadow-[0_0_6px_#3ecf8e] ${
        pos === "top" ? "-top-[5px]" : "-bottom-[5px]"
      }`}
    />
  );

  return (
    <ol
      ref={listRef}
      className="flex flex-col gap-2 text-[13px] text-fg"
      onDragOver={(e) => {
        if (dragId) e.preventDefault();
      }}
      onDrop={onDrop}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null);
      }}
    >
      {rows.map((row, i) => {
        const def = OP_BY_NAME[row.op];
        const selected = sel === row.id;
        const dragging = dragId === row.id;
        const fields = def?.fields ?? [];
        const colorFields = fields.filter((f) => f.type === "color");
        const byKey = new Map(fields.map((f) => [f.key, f]));
        const lines = (LAYOUT[row.op] ?? [])
          .map((l) => ({ ...l, fields: l.keys.map((k) => byKey.get(k)).filter((f): f is Field => !!f) }))
          .filter((l) => l.fields.length > 0);
        const placed = new Set(lines.flatMap((l) => l.fields.map((f) => f.key)));
        const rest = fields.filter((f) => f.type !== "color" && !placed.has(f.key));
        const setArg = (key: string, v: string | number) => update(row.id, (r) => ({ ...r, args: { ...r.args, [key]: v } }));
        return (
          <li
            key={row.id}
            data-row-id={row.id}
            draggable={armed === row.id}
            onDragStart={(e) => {
              setDragId(row.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", row.id);
            }}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={endDrag}
            onKeyDown={(e) => onRowKey(e, i)}
            onClick={() => select(row.id)}
            onFocus={() => {
              if (!selected) select(row.id);
            }}
            className={`group relative rounded-md border p-2 transition-[background-color,border-color,opacity] ${
              dragging
                ? "border-dashed border-accent/60 bg-bg opacity-40"
                : selected
                  ? "border-accent/60 bg-panel-hover"
                  : "border-border bg-bg hover:border-border-strong"
            }`}
          >
            {dropAt === i && indicator("top")}
            {dropAt === rows.length && i === rows.length - 1 && indicator("bottom")}

            <div className="flex items-center gap-2">
              {def ? (
                <OpSelect
                  label={`Row ${i + 1} action`}
                  value={row.op}
                  onChange={(op) => update(row.id, (r) => changeOp(r, op))}
                  className="min-w-0 flex-1"
                />
              ) : (
                <span className="flex h-7 min-w-0 flex-1 items-center truncate rounded-md border border-red-900/60 bg-red-950/30 px-2 text-[12px] text-red-300">
                  Unknown: {row.op}
                </span>
              )}
              {colorFields.length > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                  {colorFields.map((f) => (
                    <div key={f.key} className="flex items-center gap-1">
                      {colorFields.length > 1 && (
                        <span className="text-[11px] text-[#a0a0a0]">{f.key === "bg" ? "Bg" : f.label}</span>
                      )}
                      <ColorInput field={f} compact value={row.args[f.key] ?? f.default} onChange={(v) => setArg(f.key, v)} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex shrink-0 items-center">
                <div className="flex items-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    className={iconBtnCls}
                    aria-label={`Duplicate row ${i + 1}`}
                    title="Duplicate"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicate(i);
                    }}
                  >
                    <Copy size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={`${iconBtnCls} hover:bg-red-500/10`}
                    aria-label={`Delete row ${i + 1}`}
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(i);
                    }}
                  >
                    <Trash2 size={14} aria-hidden className="text-red-400" />
                  </button>
                </div>
                {/* Drag handle + row number. Only this arms the card's `draggable`, so inputs keep normal
                    text selection and focus. */}
                <button
                  type="button"
                  data-handle
                  aria-label={`Row ${i + 1}: drag to reorder, or Alt+Up/Down`}
                  title="Drag to reorder (Alt+↑/↓)"
                  onPointerDown={() => setArmed(row.id)}
                  onPointerUp={() => setArmed(null)}
                  className="ml-0.5 flex h-7 min-w-9 shrink-0 cursor-grab items-center justify-center gap-0.5 rounded-md border border-transparent pl-1 pr-1.5 text-[#5a5a5a] outline-none hover:border-border hover:bg-[#2a2a2a] hover:text-muted focus-visible:ring-1 focus-visible:ring-accent active:cursor-grabbing"
                >
                  <GripVertical size={14} aria-hidden />
                  <span className="font-mono text-[11px] tabular-nums">{i + 1}</span>
                </button>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="mt-2 grid grid-cols-[64px_84px_84px_minmax(84px,1fr)] items-center gap-x-2 gap-y-1.5">
                {lines.map((line) => (
                  <Fragment key={line.label}>
                    <span className="truncate text-[11px] text-[#a0a0a0]">{line.label}</span>
                    {line.fields.map((f, c) => (
                      <GridField
                        key={f.key}
                        field={f}
                        col={c + 1}
                        span={line.span}
                        value={row.args[f.key] ?? f.default}
                        variables={variables}
                        onChange={(v) => setArg(f.key, v)}
                      />
                    ))}
                    {/* Pad short lines so the next label starts a new grid row. */}
                    {!line.span &&
                      Array.from({ length: 3 - line.fields.length }, (_, k) => <span key={`pad${k}`} aria-hidden />)}
                  </Fragment>
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                {rest.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={row.args[f.key] ?? f.default}
                    variables={variables}
                    onChange={(v) => setArg(f.key, v)}
                  />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
