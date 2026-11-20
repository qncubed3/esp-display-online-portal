"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { newRow, toWireOps, type DrawRow } from "@/lib/draw/ops";
import DevicePreview from "./DevicePreview";
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
          <span className="text-muted">
            {rows.length} {rows.length === 1 ? "command" : "commands"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <OpSelect label="New row type" value={addOp} onChange={setAddOp} className="w-[200px]" />
            <button type="button" onClick={add} className={btnCls}>
              <Plus size={14} className="text-accent" aria-hidden /> Add row
            </button>
          </div>
        </div>
        <DrawEditor rows={rows} onChange={onChange} variables={varNames} selectedId={selectedId} onSelect={setSelectedId} />
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:sticky xl:top-4 xl:w-[680px]" aria-label="Preview">
        <div className="flex flex-col items-center">
          <DevicePreview ops={ops} />
        </div>

        <div className="rounded-md border border-border bg-bg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="font-medium">Variables</span>
            <button type="button" onClick={onRefreshData} disabled={refreshing} className={btnCls}>
              {refreshing ? (
                <LoaderCircle size={14} className="animate-spin text-muted" aria-hidden />
              ) : (
                <RefreshCw size={14} className="text-muted" aria-hidden />
              )}
              {refreshing ? "Running…" : "Refresh data"}
            </button>
          </div>
          {varsError && (
            <div className="border-b border-border bg-red-950/20 px-3 py-2 text-[12px] text-red-300">
              Data section failed: {varsError}. Variables are shown as empty in the preview.
            </div>
          )}
          {varNames.length === 0 ? (
            <div className="px-3 py-3 text-muted">{refreshing ? "Running the Data section…" : "No variables."}</div>
          ) : (
            <dl className="max-h-56 overflow-auto px-3 py-2 font-mono text-[12px]">
              {varNames.map((name) => (
                <div key={name} className="flex gap-2 py-0.5">
                  <dt className="shrink-0 text-accent">{name}</dt>
                  <span className="text-[#5a5a5a]">=</span>
                  <dd className="min-w-0 truncate text-fg" title={String(vars[name])}>
                    {JSON.stringify(vars[name])}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}
