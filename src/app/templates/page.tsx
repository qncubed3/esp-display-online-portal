import { LayoutTemplate } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import TemplateGallery from "@/components/templates/TemplateGallery";

export default function TemplatesPage() {
  return (
    <AppShell crumbs={[{ label: "Templates" }]}>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-xl font-medium">
            <LayoutTemplate size={18} className="text-muted" />
            Templates
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Ready-made services using free public APIs. Previews show sample data; your copy fetches live data.
          </p>
        </div>
        <TemplateGallery />
      </div>
    </AppShell>
  );
}
