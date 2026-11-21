"use client";

import { useMemo } from "react";
import DevicePreview from "@/components/draw/DevicePreview";
import PreviewPlaceholder from "@/components/draw/PreviewPlaceholder";
import LazyMount from "@/components/templates/LazyMount";
import LoadIntoServiceButton from "@/components/templates/LoadIntoServiceButton";
import { groupByCategory, TemplateFilterBar, useTemplateFilter } from "@/components/templates/TemplateFilters";
import UseTemplateButton from "@/components/templates/UseTemplateButton";
import { Badge } from "@/components/ui/Badge";
import { toWireOps } from "@/lib/draw/ops";
import { TEMPLATES, type Template } from "@/lib/templates/catalog";

function Preview({ t }: { t: Template }) {
  const ops = useMemo(() => toWireOps(t.rows, t.sampleVars), [t]);
  return <DevicePreview ops={ops} scale={1} />;
}

const PREVIEW_PLACEHOLDER = <PreviewPlaceholder />;

function TemplateCard({ t }: { t: Template }) {
  return (
    <li className="flex min-w-0 flex-col rounded-md border border-border bg-panel">
      <div className="flex justify-center border-b border-border bg-bg px-4 py-5">
        <LazyMount placeholder={PREVIEW_PLACEHOLDER} className="min-w-0 max-w-full">
          <Preview t={t} />
        </LazyMount>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-medium">{t.name}</h3>
        <p className="mt-1 text-[13px] text-muted">{t.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.apis.map((api) => (
            <Badge key={api}>{api}</Badge>
          ))}
        </div>
        <div className="mt-4 flex flex-1 flex-wrap items-end justify-end gap-2">
          <LoadIntoServiceButton templateId={t.id} templateName={t.name} />
          <UseTemplateButton templateId={t.id} templateName={t.name} />
        </div>
      </div>
    </li>
  );
}

const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

// Templates page body: search and category chips, then cards grouped by category ("All" with
// no search) or a flat grid of matches.
export default function TemplateGallery() {
  const f = useTemplateFilter(TEMPLATES);
  const grouped = f.category === "all" && !f.searching;

  return (
    <>
      <TemplateFilterBar {...f} className="mb-6" />
      {f.results.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-muted">No templates match your search.</p>
      ) : grouped ? (
        <div className="space-y-8">
          {groupByCategory(f.results).map(({ category: c, templates }) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`}>
              <h2 id={`cat-${c.id}`} className="mb-3 flex items-center gap-2 text-sm font-medium">
                <c.icon size={15} className="text-muted" />
                {c.label}
                <span className="text-[12px] font-normal text-muted">{templates.length}</span>
              </h2>
              <ul className={GRID}>
                {templates.map((t) => (
                  <TemplateCard key={t.id} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className={GRID}>
          {f.results.map((t) => (
            <TemplateCard key={t.id} t={t} />
          ))}
        </ul>
      )}
    </>
  );
}
