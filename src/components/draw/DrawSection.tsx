"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Braces, ChevronDown, List, LoaderCircle, Plus, Redo2, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import AiHelperButton from "@/components/ai/AiHelperButton";
import { buildDrawSkill } from "@/lib/ai/skill";
import { newRow, toWireOpsWithRows, type DrawRow } from "@/lib/draw/ops";
import EditablePreview, { INLINE_FRAME_HEIGHT } from "./EditablePreview";
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

  return (
    <div className="flex flex-col gap-6 min-w-0 rounded-md border border-border bg-panel p-4 text-[13px] text-fg md:p-5 xl:flex-row xl:items-start">
      <section className="min-w-0 flex-1" aria-label="Draw commands">
        <div className={`flex items-center justify-between gap-3 xl:mb-3 ${collapsed ? "" : "mb-3"}`}>
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
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={history.undo} disabled={!history.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={iconBtnCls}>
              <Undo2 size={14} aria-hidden />
            </button>
            <button type="button" onClick={history.redo} disabled={!history.canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={iconBtnCls}>
              <Redo2 size={14} aria-hidden />
            </button>
          </div>
        </div>
        <div id="draw-commands-body" className={collapsed ? "hidden xl:block" : ""}>
        <div className="mb-3 flex items-center justify-between gap-2">
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
          <AiHelperButton
              buildSkill={() => buildDrawSkill(vars)}
              title="AI helper: design the screen"
              fileName="SKILL.md"
              pasteStep={
                <>
                  Paste its <code className="font-mono text-fg">```json</code> block into Draw → JSON.
                </>
              }
            />
        </div>
        {mode === "rows" && (
          <div className="mb-3 flex items-center gap-2">
            <OpSelect label="New row type" value={addOp} onChange={setAddOp} className="min-w-0 flex-1" />
            <button type="button" onClick={add} className={`${btnCls} shrink-0`}>
              <Plus size={14} className="text-accent" aria-hidden /> Add row
            </button>
          </div>
        )}
        {mode === "ai" ? (
          // On xl the chat is exactly as tall as the preview frame beside it.
          <div
            className="flex flex-col xl:h-[var(--preview-h)] [&>*]:min-h-0 [&>*]:flex-1"
            style={{ "--preview-h": `${INLINE_FRAME_HEIGHT}px` } as CSSProperties}
          >
            {aiPanel}
          </div>
        ) : mode === "rows" ? (
          <DrawEditor rows={rows} onChange={onChange} variables={varNames} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <DrawJsonEditor rows={rows} onChange={onChange} />
        )}
        </div>
      </section>

      <aside className="flex w-full min-w-0 shrink-0 flex-col gap-3 xl:sticky xl:top-4 xl:w-auto" aria-label="Preview">
        {/* Same height as the "Draw" header row and the same gap below it, so the preview's top
            lines up with the AI/Rows/JSON switcher. */}
        <div className="flex h-7 items-center justify-end gap-3">
          {varsError && (
            <span className="min-w-0 truncate text-[12px] text-red-300" title={varsError}>
              Data failed; variables are empty in the preview.
            </span>
          )}
          <button type="button" onClick={onRefreshData} disabled={refreshing} className={btnCls}>
            {refreshing ? (
              <LoaderCircle size={14} className="animate-spin text-muted" aria-hidden />
            ) : (
              <RefreshCw size={14} className="text-muted" aria-hidden />
            )}
            {refreshing ? "Running…" : "Refresh data"}
          </button>
        </div>

        <div className="flex min-w-0 flex-col items-center">
          <EditablePreview
            rows={rows}
            ops={ops}
            rowIds={rowIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRowChange={(row) => onChange(rows.map((r) => (r.id === row.id ? row : r)))}
          />
        </div>
      </aside>
    </div>
  );
}
