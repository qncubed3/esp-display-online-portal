"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/components/ui/cn";
import { SCREEN_HEIGHT, SCREEN_WIDTH, toWireOps } from "@/lib/draw/ops";
import { renderPreview } from "@/lib/draw/preview";
import LazyMount from "@/components/templates/LazyMount";
import { TemplateFilterBar, useTemplateFilter } from "@/components/templates/TemplateFilters";
import { TEMPLATES, type Template } from "@/lib/templates/catalog";

export type LoadMode = "both" | "draw" | "data";

const MODES: { id: LoadMode; label: string; hint: string }[] = [
  { id: "both", label: "Data and Draw", hint: "Replace both" },
  { id: "draw", label: "Draw only", hint: "Keep my Data code" },
  { id: "data", label: "Data only", hint: "Keep my Draw rows" },
];

// The template's screen with sample data, filling the card's width (no bezel or coordinates).
function ScreenThumb({ t }: { t: Template }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) renderPreview(ctx, toWireOps(t.rows, t.sampleVars));
  }, [t]);
  return (
    <canvas
      ref={ref}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      aria-hidden
      className="block w-full rounded-[3px] bg-black"
      style={{ aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}`, imageRendering: "pixelated" }}
    />
  );
}

// Same size as ScreenThumb, shown until the card nears the visible part of the grid.
const THUMB_PLACEHOLDER = (
  <div
    aria-hidden
    className="block w-full rounded-[3px] bg-black"
    style={{ aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}` }}
  />
);

function TemplateCard({ t, selected, onSelect }: { t: Template; selected: boolean; onSelect(): void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex h-full cursor-pointer flex-col overflow-hidden rounded-md border bg-panel text-left transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent/50",
        selected ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong hover:bg-panel-hover",
      )}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[#111] shadow">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <div className="border-b border-border bg-[#111] p-2.5">
        <LazyMount placeholder={THUMB_PLACEHOLDER}>
          <ScreenThumb t={t} />
        </LazyMount>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="text-[13px] font-medium leading-snug text-fg">{t.name}</span>
        <span className="line-clamp-2 text-[12px] leading-relaxed text-muted">{t.description}</span>
        <span className="mt-auto flex flex-wrap gap-1 pt-1.5">
          {t.apis.map((api) => (
            <Badge key={api}>{api}</Badge>
          ))}
        </span>
      </div>
    </button>
  );
}

export default function LoadTemplateDialog({
  open,
  onClose,
  hasCode,
  rowCount,
  onLoad,
  initialTemplateId,
}: {
  open: boolean;
  onClose(): void;
  /** The Service's current Data code is non-empty. */
  hasCode: boolean;
  /** Number of Draw rows the Service currently has. */
  rowCount: number;
  onLoad(template: Template, mode: LoadMode): void;
  /** Template to have selected when the dialog opens (e.g. arriving from the Templates page). */
  initialTemplateId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (open && initialTemplateId) setSelectedId(initialTemplateId);
  }, [open, initialTemplateId]);
  const [mode, setMode] = useState<LoadMode>("both");
  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? null;
  const filter = useTemplateFilter(TEMPLATES);

  function close() {
    setSelectedId(null);
    setMode("both");
    filter.setQuery("");
    filter.setCategory("all");
    onClose();
  }

  function load() {
    if (!selected) return;
    onLoad(selected, mode);
    close();
  }

  const replaced: string[] = [];
  if (mode !== "draw" && hasCode) replaced.push("your Data code");
  if (mode !== "data" && rowCount > 0) replaced.push(`your ${rowCount} Draw ${rowCount === 1 ? "row" : "rows"}`);

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Load a template"
      // Fits the viewport: header and footer stay put, only the card grid scrolls.
      className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl overflow-hidden open:flex open:flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
      footer={
        <>
          <Button size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={load} disabled={!selected}>
            <LayoutTemplate size={14} />
            Load template
          </Button>
        </>
      }
    >
      {open && (
        <>
          <p className="shrink-0 text-[13px] text-muted">
            Pick a template to load into this Service. Previews show sample data.
          </p>

          <TemplateFilterBar {...filter} className="shrink-0" />

          <div
            role="radiogroup"
            aria-label="Templates"
            className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1"
          >
            {filter.results.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted">No templates match your search.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filter.results.map((t) => (
                  <TemplateCard key={t.id} t={t} selected={t.id === selectedId} onSelect={() => setSelectedId(t.id)} />
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-border pt-4">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-fg">What to load</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {MODES.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50",
                      mode === m.id ? "border-accent bg-accent/5" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="load-template-mode"
                      value={m.id}
                      checked={mode === m.id}
                      onChange={() => setMode(m.id)}
                      className="mt-0.5 accent-[#3ecf8e]"
                    />
                    <span className="flex flex-col">
                      <span className="text-[13px] text-fg">{m.label}</span>
                      <span className="text-[12px] text-muted">{m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {replaced.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-[#f5a623]/40 bg-[#f5a623]/10 px-3 py-2 text-[13px] text-[#ffc965]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <p>
                  This replaces {replaced.join(" and ")}. Nothing is deployed until you click Save &amp; deploy, so
                  you can still undo by reloading the page without saving.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
