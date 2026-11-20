"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { saveDrawOps } from "@/app/services/[id]/actions";
import { toWireOps, type DrawRow } from "@/lib/draw/ops";
import DevicePreview from "./DevicePreview";
import DrawEditor from "./DrawEditor";

type Vars = Record<string, string | number | boolean>;
type VarsResult = { vars: Vars; error: string | null };

// Runs the Data section on the server. Never throws; on failure vars is {} (or partial) and error is set.
async function fetchVars(serviceId: string): Promise<VarsResult> {
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
    const body = (await res.json().catch(() => null)) as { vars?: Vars; error?: string } | null;
    const vars = body?.vars && typeof body.vars === "object" ? body.vars : {};
    if (!res.ok || !body || body.error) return { vars, error: body?.error || `Preview request failed (${res.status})` };
    return { vars, error: null };
  } catch (e) {
    return { vars: {}, error: e instanceof Error ? e.message : "Could not load variables" };
  }
}

const btnCls =
  "inline-flex h-7 items-center rounded-md border px-3 text-[13px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[#3ecf8e] disabled:cursor-not-allowed disabled:opacity-50";

export default function DrawTab({ serviceId, initialRows }: { serviceId: string; initialRows: DrawRow[] }) {
  const [rows, setRows] = useState<DrawRow[]>(initialRows);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialRows));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [vars, setVars] = useState<Vars>({});
  const [varsError, setVarsError] = useState<string | null>(null);
  const [loadingVars, setLoadingVars] = useState(true); // the mount effect starts a load

  const dirty = JSON.stringify(rows) !== savedJson;

  const applyVars = useCallback((r: VarsResult) => {
    setVars(r.vars);
    setVarsError(r.error);
    setLoadingVars(false);
  }, []);

  useEffect(() => {
    let live = true;
    fetchVars(serviceId).then((r) => {
      if (live) applyVars(r);
    });
    return () => {
      live = false;
    };
  }, [serviceId, applyVars]);

  const refresh = () => {
    setLoadingVars(true);
    void fetchVars(serviceId).then(applyVars);
  };

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const snapshot = rows;
    try {
      await saveDrawOps(serviceId, snapshot);
      setSavedJson(JSON.stringify(snapshot));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [rows, saving, serviceId]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const ops = useMemo(() => toWireOps(rows, vars), [rows, vars]);
  const varNames = useMemo(() => Object.keys(vars).sort(), [vars]);

  return (
    <div className="flex flex-col gap-6 text-[13px] text-[#ededed] xl:flex-row xl:items-start">
      <section className="min-w-0 flex-1" aria-label="Draw commands">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[14px] font-medium">Draw</h2>
          <span className="text-[#a0a0a0]">{rows.length} {rows.length === 1 ? "command" : "commands"}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-[12px] ${saveError ? "text-red-400" : dirty ? "text-amber-300" : "text-[#a0a0a0]"}`} role="status">
              {saving ? "Saving…" : saveError ? `Save failed: ${saveError}` : dirty ? "Unsaved changes" : "Saved"}
            </span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              title="Save (Ctrl+S)"
              className={`${btnCls} border-[#3ecf8e]/70 bg-[#3ecf8e]/15 text-[#ededed] hover:bg-[#3ecf8e]/25 disabled:border-[#2e2e2e] disabled:bg-transparent disabled:text-[#a0a0a0]`}
            >
              Save
            </button>
          </div>
        </div>
        <DrawEditor rows={rows} onChange={setRows} variables={varNames} selectedId={selectedId} onSelect={setSelectedId} />
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:sticky xl:top-4 xl:w-[680px]" aria-label="Preview">
        <div className="flex flex-col items-center">
          <DevicePreview ops={ops} />
        </div>

        <div className="rounded-md border border-[#2e2e2e] bg-[#1c1c1c]">
          <div className="flex items-center justify-between border-b border-[#2e2e2e] px-3 py-2">
            <span className="font-medium">Variables</span>
            <button
              type="button"
              onClick={refresh}
              disabled={loadingVars}
              className={`${btnCls} border-[#2e2e2e] bg-[#232323] text-[#ededed] hover:bg-[#2a2a2a]`}
            >
              {loadingVars ? "Running…" : "Refresh data"}
            </button>
          </div>
          {varsError && (
            <div className="border-b border-[#2e2e2e] bg-red-950/20 px-3 py-2 text-[12px] text-red-300">
              Data section failed: {varsError}. Variables are shown as empty in the preview.
            </div>
          )}
          {varNames.length === 0 ? (
            <div className="px-3 py-3 text-[#a0a0a0]">{loadingVars ? "Running the Data section…" : "No variables."}</div>
          ) : (
            <dl className="max-h-56 overflow-auto px-3 py-2 font-mono text-[12px]">
              {varNames.map((name) => (
                <div key={name} className="flex gap-2 py-0.5">
                  <dt className="shrink-0 text-[#3ecf8e]">{name}</dt>
                  <span className="text-[#5a5a5a]">=</span>
                  <dd className="min-w-0 truncate text-[#ededed]" title={String(vars[name])}>
                    {JSON.stringify(vars[name])}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <details className="group rounded-md border border-[#2e2e2e] bg-[#1c1c1c]">
          <summary className="cursor-pointer select-none px-3 py-2 text-[#a0a0a0] outline-none hover:text-[#ededed] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]">
            Export JSON <span className="text-[12px]">({ops.length} ops sent to the device)</span>
          </summary>
          <div className="relative border-t border-[#2e2e2e]">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(JSON.stringify(ops))}
              className={`${btnCls} absolute right-2 top-2 border-[#2e2e2e] bg-[#232323] text-[12px] text-[#a0a0a0] hover:text-[#ededed]`}
            >
              Copy
            </button>
            <pre className="max-h-72 overflow-auto p-3 font-mono text-[12px] leading-5 text-[#ededed]">
              {"[\n" + ops.map((o) => "  " + JSON.stringify(o)).join(",\n") + "\n]"}
            </pre>
          </div>
        </details>
      </aside>
    </div>
  );
}
