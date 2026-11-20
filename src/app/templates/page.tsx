import { LayoutTemplate } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import DevicePreview from "@/components/draw/DevicePreview";
import UseTemplateButton from "@/components/templates/UseTemplateButton";
import { Badge } from "@/components/ui/Badge";
import { toWireOps } from "@/lib/draw/ops";
import { TEMPLATES } from "@/lib/templates/catalog";

export default function TemplatesPage() {

  return (
    <AppShell crumbs={[{ label: "Templates" }]}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-xl font-medium">
            <LayoutTemplate size={18} className="text-muted" />
            Templates
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Ready-made services using free public APIs. Previews show sample data; your copy fetches live data.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <li key={t.id} className="flex flex-col rounded-md border border-border bg-panel">
              <div className="flex justify-center border-b border-border bg-bg px-4 py-5">
                <DevicePreview ops={toWireOps(t.rows, t.sampleVars)} scale={1} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-sm font-medium">{t.name}</h2>
                <p className="mt-1 text-[13px] text-muted">{t.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.apis.map((api) => (
                    <Badge key={api}>{api}</Badge>
                  ))}
                </div>
                <div className="mt-4 flex flex-1 items-end justify-end">
                  <UseTemplateButton templateId={t.id} templateName={t.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
