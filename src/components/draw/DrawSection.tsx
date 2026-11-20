"use client";

import { useMemo, useState } from "react";
import { Braces, List, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import AiHelperButton from "@/components/ai/AiHelperButton";
import { buildDrawSkill } from "@/lib/ai/skill";
import { newRow, toWireOps, type DrawRow } from "@/lib/draw/ops";
import DevicePreview from "./DevicePreview";
import DrawJsonEditor from "./DrawJsonEditor";
import DrawEditor, { OpSelect } from "./DrawEditor";

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
}) {
  const { rows, onChange, vars, varsError, refreshing, onRefreshData } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOp, setAddOp] = useState("drawString");
  const [mode, setMode] = useState<"rows" | "json">("rows");

  const ops = useMemo(() => toWireOps(rows, vars), [rows, vars]);
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
    <div className="flex flex-col gap-6 rounded-md border border-border bg-panel p-5 text-[13px] text-fg xl:flex-row xl:items-start">
      <section className="min-w-0 flex-1" aria-label="Draw commands">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-[14px] font-medium">Draw</h2>
          <div role="group" aria-label="Editor view" className="inline-flex h-7 shrink-0 rounded-md border border-border bg-bg p-0.5">
            {(
              [
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
          <span className="text-muted">
            {rows.length} {rows.length === 1 ? "command" : "commands"}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {mode === "rows" && (
              <>
                <OpSelect label="New row type" value={addOp} onChange={setAddOp} className="w-[200px]" />
                <button type="button" onClick={add} className={btnCls}>
                  <Plus size={14} className="text-accent" aria-hidden /> Add row
                </button>
              </>
            )}
            <AiHelperButton
              buildSkill={() => buildDrawSkill(vars)}
              title="AI helper: design the screen"
              fileName="SKILL.md"
              intro="Describe the screen you want, then paste the JSON it returns into the JSON editor."
              pasteStep={
                <>
                  The AI replies with a <code className="font-mono text-fg">```json</code> code block. Copy it, switch Draw
                  to <span className="text-fg">JSON</span> view, and paste it there (replacing what&apos;s in the editor).
                </>
              }
            />
          </div>
        </div>
        {mode === "rows" ? (
          <DrawEditor rows={rows} onChange={onChange} variables={varNames} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <DrawJsonEditor rows={rows} onChange={onChange} />
        )}
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:sticky xl:top-4 xl:w-[680px]" aria-label="Preview">
        <div className="flex flex-col items-center">
          <DevicePreview ops={ops} />
        </div>

        <div className="flex items-center justify-end gap-3">
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
      </aside>
    </div>
  );
}
