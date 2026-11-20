"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { OPS, OP_BY_NAME, SWATCHES, newRow, type DrawRow, type Field } from "@/lib/draw/ops";

export interface DrawEditorProps {
  rows: DrawRow[];
  onChange(rows: DrawRow[]): void;
  variables: string[];
  selectedId?: string | null;
  onSelect?(id: string | null): void;
}

const GROUPS = ["Screen", "Shapes", "Text"] as const;

const inputCls =
  "h-7 rounded-md border border-[#2e2e2e] bg-[#161616] px-2 text-[13px] text-[#ededed] outline-none placeholder:text-[#5a5a5a] hover:border-[#3e3e3e] focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/30";
const iconBtnCls =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#a0a0a0] outline-none hover:bg-[#2a2a2a] hover:text-[#ededed] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]";

function OpSelect({ value, onChange, className = "", label }: { value: string; onChange(op: string): void; className?: string; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-6 ${className}`}>
      {GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {OPS.filter((d) => d.group === g).map((d) => (
            <option key={d.op} value={d.op}>
              {d.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// Integer field: accepts numbers or text containing {var}.
function IntInput({ field, value, onChange }: { field: Field; value: string | number; onChange(v: string | number): void }) {
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
      className={`${inputCls} ${isVar ? "w-28 text-[#3ecf8e]" : "w-14"} tabular-nums`}
    />
  );
}

function ColorInput({ field, value, onChange }: { field: Field; value: string | number; onChange(v: string): void }) {
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
        className="flex h-7 items-center gap-1.5 rounded-md border border-[#2e2e2e] bg-[#161616] px-1.5 text-[12px] text-[#a0a0a0] outline-none hover:border-[#3e3e3e] focus-visible:border-[#3ecf8e]"
      >
        <span
          className="h-4 w-4 rounded-sm border border-[#3e3e3e]"
          style={
            none
              ? { background: "repeating-conic-gradient(#3a3a3a 0% 25%, #1c1c1c 0% 50%) 0 0 / 6px 6px" }
              : { background: isHex ? str : "#2a2a2a" }
          }
        />
        <span className="max-w-[72px] truncate">{none ? "none" : name ?? str}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 w-[188px] rounded-md border border-[#2e2e2e] bg-[#1c1c1c] p-2 shadow-xl">
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

function SelectInput({ field, value, onChange }: { field: Field; value: string | number; onChange(v: string | number): void }) {
  const opts = field.options ?? [];
  const str = String(value ?? "");
  const known = opts.some((o) => String(o.value) === str);
  return (
    <select
      aria-label={field.label}
      title={field.label}
      value={str}
      onChange={(e) => {
        const o = opts.find((o) => String(o.value) === e.target.value);
        onChange(o ? o.value : e.target.value);
      }}
      className={`${inputCls} pr-6`}
    >
      {!known && <option value={str}>{str || "—"}</option>}
      {opts.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldInput(props: { field: Field; value: string | number; onChange(v: string | number): void; variables: string[] }) {
  const { field } = props;
  const input =
    field.type === "int" ? (
      <IntInput {...props} />
    ) : field.type === "color" ? (
      <ColorInput {...props} />
    ) : field.type === "select" ? (
      <SelectInput {...props} />
    ) : (
      <TextInput {...props} />
    );
  return (
    <div className={`flex items-center gap-1 ${field.type === "text" ? "min-w-[180px] flex-1" : ""}`}>
      {field.type !== "text" && <span className="text-[11px] text-[#a0a0a0]">{field.label.replace(/^(Width|Height|Radius)$/, (m) => m[0])}</span>}
      {input}
    </div>
  );
}

// Changing type: new op's defaults, keeping values whose keys match.
function changeOp(row: DrawRow, op: string): DrawRow {
  const fresh = newRow(op);
  const def = OP_BY_NAME[op];
  const args: DrawRow["args"] = { ...fresh.args };
  for (const f of def.fields) if (f.key in row.args) args[f.key] = row.args[f.key];
  return { ...row, op, args };
}

export default function DrawEditor({ rows, onChange, variables, selectedId, onSelect }: DrawEditorProps) {
  const [localSel, setLocalSel] = useState<string | null>(null);
  const sel = selectedId !== undefined ? selectedId : localSel;
  const select = (id: string | null) => {
    setLocalSel(id);
    onSelect?.(id);
  };

  const [addOp, setAddOp] = useState("drawString");
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

  const add = () => {
    const r = newRow(addOp);
    onChange([...rows, r]);
    select(r.id);
  };

  const onRowKey = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    if (!e.altKey) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const to = i + (e.key === "ArrowUp" ? -1 : 1);
      if (to < 0 || to >= rows.length) return;
      const id = rows[i].id;
      move(i, to);
      focusRow(id);
    }
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>, i: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragId != null && dropAt != null) {
      const from = rows.findIndex((r) => r.id === dragId);
      if (from >= 0) move(from, dropAt > from ? dropAt - 1 : dropAt);
    }
    endDrag();
  };

  const endDrag = () => {
    setDragId(null);
    setDropAt(null);
    setArmed(null);
  };

  return (
    <div className="text-[13px] text-[#ededed]">
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#2e2e2e] px-4 py-8 text-center text-[#a0a0a0]">
          No draw commands yet. Add one below. Rows run top to bottom, like the device draws them.
        </div>
      ) : (
        <ol ref={listRef} className="flex flex-col" onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null);
        }}>
          {rows.map((row, i) => {
            const def = OP_BY_NAME[row.op];
            const selected = sel === row.id;
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
                onDrop={onDrop}
                onDragEnd={endDrag}
                onKeyDown={(e) => onRowKey(e, i)}
                onClick={() => select(row.id)}
                onFocus={() => {
                  if (!selected) select(row.id);
                }}
                className={`group relative -mt-px flex flex-wrap items-center gap-x-2 gap-y-1.5 border px-2 py-1.5 first:mt-0 first:rounded-t-md last:rounded-b-md ${
                  selected ? "z-10 border-[#3ecf8e]/60 bg-[#232323]" : "border-[#2e2e2e] bg-[#1c1c1c] hover:bg-[#202020]"
                } ${dragId === row.id ? "opacity-40" : ""}`}
              >
                {dropAt === i && <div className="pointer-events-none absolute -top-[2px] left-0 right-0 h-[3px] rounded bg-[#3ecf8e]" />}
                {dropAt === rows.length && i === rows.length - 1 && (
                  <div className="pointer-events-none absolute -bottom-[2px] left-0 right-0 h-[3px] rounded bg-[#3ecf8e]" />
                )}
                <button
                  type="button"
                  data-handle
                  aria-label={`Row ${i + 1}: drag to reorder, or Alt+Up/Down`}
                  title="Drag to reorder (Alt+↑/↓)"
                  onPointerDown={() => setArmed(row.id)}
                  onPointerUp={() => setArmed(null)}
                  className="flex h-7 w-5 cursor-grab items-center justify-center rounded text-[#5a5a5a] outline-none hover:text-[#a0a0a0] focus-visible:ring-1 focus-visible:ring-[#3ecf8e] active:cursor-grabbing"
                >
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden>
                    {[0, 5, 10].map((y) => (
                      <g key={y}>
                        <circle cx="2" cy={y + 2} r="1.2" />
                        <circle cx="6" cy={y + 2} r="1.2" />
                      </g>
                    ))}
                  </svg>
                </button>
                <span className="w-5 text-right font-mono text-[11px] tabular-nums text-[#5a5a5a]">{i + 1}</span>
                {def ? (
                  <OpSelect label={`Row ${i + 1} action`} value={row.op} onChange={(op) => update(row.id, (r) => changeOp(r, op))} className="w-[170px]" />
                ) : (
                  <span className="rounded-md border border-red-900/60 bg-red-950/30 px-2 py-1 text-[12px] text-red-300">Unknown: {row.op}</span>
                )}
                {def?.fields.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={row.args[f.key] ?? f.default}
                    variables={variables}
                    onChange={(v) => update(row.id, (r) => ({ ...r, args: { ...r.args, [f.key]: v } }))}
                  />
                ))}
                <div className="ml-auto flex items-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" className={iconBtnCls} aria-label={`Duplicate row ${i + 1}`} title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(i); }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                      <rect x="5" y="5" width="9" height="9" rx="1.5" />
                      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
                    </svg>
                  </button>
                  <button type="button" className={`${iconBtnCls} hover:text-red-400`} aria-label={`Delete row ${i + 1}`} title="Delete" onClick={(e) => { e.stopPropagation(); remove(i); }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex items-center gap-2">
        <OpSelect label="New row action" value={addOp} onChange={setAddOp} className="w-[190px]" />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#2e2e2e] bg-[#232323] px-3 text-[13px] text-[#ededed] outline-none hover:border-[#3e3e3e] hover:bg-[#2a2a2a] focus-visible:border-[#3ecf8e]"
        >
          <span className="text-[#3ecf8e]">+</span> Add row
        </button>
      </div>
    </div>
  );
}
