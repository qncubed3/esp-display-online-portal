"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { AlertCircle, Check, Loader2, Play, Rocket } from "lucide-react";
import { saveService } from "@/app/services/[id]/actions";
import AiHelperButton from "@/components/ai/AiHelperButton";
import DataEditor from "@/components/data/DataEditor";
import VariablesPanel from "@/components/data/VariablesPanel";
import DevicesPanel from "@/components/devices/DevicesPanel";
import DrawSection from "@/components/draw/DrawSection";
import ActivitySection from "@/components/stats/ActivitySection";
import { Button } from "@/components/ui/Button";
import { buildAiSkill } from "@/lib/ai/skill";
import type { DrawRow } from "@/lib/draw/ops";

type Vars = Record<string, string | number | boolean>;

function Section({ children }: { children: ReactNode }) {
  return <section className="rounded-md border border-border bg-panel p-5">{children}</section>;
}

function SectionTitle({ title, hint, actions }: { title: string; hint?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[14px] font-medium text-fg">{title}</h2>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      {actions}
    </div>
  );
}

export default function ServiceEditor({
  serviceId,
  initialCode,
  initialRows,
}: {
  serviceId: string;
  initialCode: string;
  initialRows: DrawRow[];
}) {
  const [code, setCode] = useState(initialCode);
  const [rows, setRows] = useState<DrawRow[]>(initialRows);
  const [saved, setSaved] = useState({ code: initialCode, rows: JSON.stringify(initialRows) });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const dirty = code !== saved.code || JSON.stringify(rows) !== saved.rows;

  // ---------- preview variables (runs the current, unsaved Data code)

  const [vars, setVars] = useState<Vars>({});
  const [varsError, setVarsError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const codeRef = useRef(code);
  codeRef.current = code;
  const requestId = useRef(0);

  const refreshData = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, code: codeRef.current }),
      });
      const body = (await res.json().catch(() => ({}))) as { vars?: Vars; error?: string };
      if (id !== requestId.current) return; // a newer run superseded this one
      if (body.vars && typeof body.vars === "object") setVars(body.vars);
      setVarsError(body.error ?? (res.ok ? undefined : `Preview failed (HTTP ${res.status})`));
    } catch (e) {
      if (id !== requestId.current) return;
      setVarsError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // ---------- save & deploy

  const save = useCallback(() => {
    if (!dirty || saving) return;
    const snapshot = { code, rows };
    setSaveError(null);
    startSave(async () => {
      try {
        await saveService(serviceId, { data_code: snapshot.code, draw_ops: snapshot.rows });
        setSaved({ code: snapshot.code, rows: JSON.stringify(snapshot.rows) });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }, [dirty, saving, code, rows, serviceId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="mt-6 flex flex-col gap-5">
      <Section>
        <DevicesPanel serviceId={serviceId} />
      </Section>

      <ActivitySection serviceId={serviceId} />

      <Section>
        <SectionTitle
          title="Data"
          hint={
            <>
              JavaScript. Use <code className="font-mono text-fg">get(url)</code> and{" "}
              <code className="font-mono text-fg">export const name = …</code>, then use{" "}
              <code className="font-mono text-fg">{"{name}"}</code> in Draw.
            </>
          }
          actions={
            <div className="flex shrink-0 items-center gap-2">
              <AiHelperButton
                buildSkill={buildAiSkill}
                title="AI helper: build this service"
                fileName="SKILL.md"
                intro={
                  <>
                    Copy this into Claude (or any AI), then tell it your API URLs and what you want shown. It replies with
                    JavaScript to paste into Data and a JSON array to paste into Draw&apos;s JSON editor.
                  </>
                }
                pasteStep={
                  <>
                    The AI replies with two code blocks. Copy the <code className="font-mono text-fg">```js</code> block
                    into the Data editor, and the <code className="font-mono text-fg">```json</code> block into Draw → JSON
                    view (switch the Draw header to JSON first).
                  </>
                }
              />
              <Button size="sm" onClick={() => void refreshData()} disabled={refreshing} title="Run the Data code and refresh the preview">
                {refreshing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run
              </Button>
            </div>
          }
        />
        <DataEditor value={code} onChange={setCode} />
        <VariablesPanel vars={vars} error={varsError} running={refreshing} />
      </Section>

      <DrawSection
        rows={rows}
        onChange={setRows}
        vars={vars}
        varsError={varsError}
        refreshing={refreshing}
        onRefreshData={() => void refreshData()}
      />

      <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-bg/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-end gap-3">
          {saveError ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-[#ff8a8e]">
              <AlertCircle size={14} className="shrink-0" />
              <span className="truncate">{saveError}</span>
            </span>
          ) : dirty ? (
            <span className="text-[13px] text-muted">Unsaved changes</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <Check size={14} className="text-accent" /> All changes deployed
            </span>
          )}
          <Button variant="primary" onClick={save} disabled={!dirty || saving} title="Save & deploy (Ctrl+S)">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            Save &amp; deploy
          </Button>
        </div>
      </div>
    </div>
  );
}
