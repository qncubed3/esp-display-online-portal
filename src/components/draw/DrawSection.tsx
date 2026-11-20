"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Braces, ChevronDown, List, LoaderCircle, Maximize2, Plus, Redo2, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import { newRow, toWireOpsWithRows, type DrawRow } from "@/lib/draw/ops";
import EditablePreview, { INLINE_FRAME_HEIGHT, INLINE_FRAME_WIDTH, previewHint } from "./EditablePreview";
import DrawJsonEditor from "./DrawJsonEditor";
import DrawEditor, { OpSelect } from "./DrawEditor";

const iconBtnCls =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-panel-hover text-fg outline-none transition-colors hover:border-border-strong hover:bg-[#2a2a2a] focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-panel-hover";

const btnCls =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-panel-hover px-3 text-[13px] text-fg outline-none transition-colors hover:border-border-strong hover:bg-[#2a2a2a] focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

// The Draw part of the service page. Stateless about persistence: the parent owns rows, the
// Data section's variables and saving; this renders the editor and a live preview.
export default function DrawSection(props: {
  rows: DrawRow[];
  onChange(rows: DrawRow[]): void;
  vars: Record<string, string | number | boolean>;
  varsError?: string;
  refreshing: boolean;
  onRefreshData(): void;
  /** The AI assistant, shown in the commands panel's "AI" view. */
  aiPanel?: ReactNode;
  history: { undo(): void; redo(): void; canUndo: boolean; canRedo: boolean };
}) {
  const { rows, onChange, vars, varsError, refreshing, onRefreshData, aiPanel, history } = props;
  // Below xl (stacked layout) the commands start collapsed so the preview is visible right away.
  const [collapsed, setCollapsed] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOp, setAddOp] = useState("text");
  const [mode, setMode] = useState<"ai" | "rows" | "json">(aiPanel ? "ai" : "rows");

  const { ops, rowIds } = useMemo(() => toWireOpsWithRows(rows, vars), [rows, vars]);
  const varNames = useMemo(() => Object.keys(vars).sort(), [vars]);

  const add = () => {
    const r = newRow(addOp);
    onChange([...rows, r]);
    setSelectedId(r.id);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-row-id="${r.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  };

  const switcher = (
    <div role="group" aria-label="Editor view" className="inline-flex h-7 shrink-0 rounded-md border border-border bg-bg p-0.5">
      {(
        [
          ...(aiPanel ? ([["ai", "AI", Sparkles]] as const) : []),
          ["rows", "Rows", List],
          ["json", "JSON", Braces],
        ] as const
      ).map(([m, label, Icon]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`inline-flex items-center gap-1.5 rounded px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-accent ${
            mode === m ? "bg-panel-hover text-fg" : "text-muted hover:text-fg"
          }`}
        >
          <Icon size={13} aria-hidden /> {label}
        </button>
      ))}
    </div>
  );

  const [full, setFull] = useState(false);
  const selRow = selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null;
  const hint = previewHint(selRow);

  // One grid, two rows on xl: the headers share row 1 and the editor and preview share row 2, so
  // the chat and the preview always start at the same height (the chat is as tall as the preview).
  // DOM order is the stacked (mobile) order: header, commands, toolbar, preview.
  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border bg-panel p-4 text-[13px] text-fg md:p-5 xl:grid-cols-[minmax(0,1fr)_var(--preview-w)]"
      style={{ "--preview-w": `${INLINE_FRAME_WIDTH}px`, "--preview-h": `${INLINE_FRAME_HEIGHT}px` } as CSSProperties}
    >
      <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 xl:col-start-1 xl:row-start-1">
        <h2 className="min-w-0 text-[14px] font-medium">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls="draw-commands-body"
            className="-mx-1 inline-flex min-w-0 items-baseline gap-3 rounded px-1 outline-none focus-visible:ring-1 focus-visible:ring-accent xl:pointer-events-none"
          >
            <ChevronDown
              size={14}
              aria-hidden
              className={`shrink-0 self-center text-muted transition-transform xl:hidden ${collapsed ? "-rotate-90" : ""}`}
            />
            Draw
            <span className="truncate font-normal text-muted">
              {rows.length} {rows.length === 1 ? "command" : "commands"}
            </span>
          </button>
        </h2>
        <div className={collapsed ? "hidden xl:flex" : "flex"}>{switcher}</div>
      </div>

      <section
        id="draw-commands-body"
        aria-label="Draw commands"
        className={`min-w-0 xl:col-start-1 xl:row-start-2 ${collapsed ? "hidden xl:block" : ""}`}
      >
        {mode === "rows" && (
          <div className="mb-3 flex items-center gap-2">
            <OpSelect label="New row type" value={addOp} onChange={setAddOp} className="min-w-0 flex-1" />
            <button type="button" onClick={add} className={`${btnCls} shrink-0`}>
              <Plus size={14} className="text-accent" aria-hidden /> Add row
            </button>
          </div>
        )}
        {mode === "ai" ? (
          <div className="flex flex-col xl:h-[var(--preview-h)] [&>*]:min-h-0 [&>*]:flex-1">{aiPanel}</div>
        ) : mode === "rows" ? (
          <DrawEditor rows={rows} onChange={onChange} variables={varNames} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <DrawJsonEditor rows={rows} onChange={onChange} />
        )}
      </section>

      <div className="mt-3 flex h-7 min-w-0 items-center gap-1.5 xl:col-start-2 xl:row-start-1 xl:mt-0">
        <p className="mr-auto min-w-0 truncate text-[12px] text-muted" title={hint}>
          {hint}
        </p>
        <button type="button" onClick={() => setFull(true)} title="Full screen" aria-label="Edit in full screen" className={iconBtnCls}>
          <Maximize2 size={14} aria-hidden />
        </button>
        <button type="button" onClick={history.undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={iconBtnCls}>
          <Undo2 size={14} aria-hidden />
        </button>
        <button type="button" onClick={history.redo} disabled={!history.canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={iconBtnCls}>
          <Redo2 size={14} aria-hidden />
        </button>
        <button type="button" onClick={onRefreshData} disabled={refreshing} className={btnCls}>
          {refreshing ? (
            <LoaderCircle size={14} className="animate-spin text-muted" aria-hidden />
          ) : (
            <RefreshCw size={14} className="text-muted" aria-hidden />
          )}
          {refreshing ? "Running…" : "Refresh data"}
        </button>
      </div>

      <aside className="flex min-w-0 flex-col items-center xl:sticky xl:top-4 xl:col-start-2 xl:row-start-2 xl:self-start" aria-label="Preview">
        <EditablePreview
          rows={rows}
          ops={ops}
          rowIds={rowIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRowChange={(row) => onChange(rows.map((r) => (r.id === row.id ? row : r)))}
          full={full}
          onFullChange={setFull}
        />
        {varsError && (
          <p className="mt-1 max-w-full truncate text-[12px] text-red-300" title={varsError}>
            Data failed; variables are empty in the preview.
          </p>
        )}
      </aside>
    </div>
  );
}
