"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/components/ui/cn";
import { createClient } from "@/lib/supabase/client";

interface ServiceOption {
  id: string;
  name: string;
  shared: boolean;
}

// Templates page: put a template into a Service you already have. Opens that Service with the
// template picked in its Load template dialog, where you choose what to replace; nothing is
// deployed until Save & deploy.
export default function LoadIntoServiceButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!open || services) return;
    const supabase = createClient();
    void (async () => {
      const [{ data: auth }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        // RLS returns the user's own Services and those shared with them.
        supabase.from("services").select("id, name, owner_id").order("updated_at", { ascending: false }),
      ]);
      if (error) {
        setError(error.message);
        return;
      }
      const me = auth.user?.id;
      setServices((data ?? []).map((s) => ({ id: s.id, name: s.name, shared: s.owner_id !== me })));
    })();
  }, [open, services]);

  const go = (serviceId: string) => router.push(`/services/${serviceId}?template=${encodeURIComponent(templateId)}#draw`);

  function close() {
    setOpen(false);
    setChosen(null);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Load into a Service
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={`Load “${templateName}” into…`}
        footer={
          <>
            <Button size="sm" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={!chosen} onClick={() => chosen && go(chosen)}>
              Open in editor <ArrowRight size={14} />
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[13px] text-muted">
          Pick a Service. It opens with this template ready to load, and you choose whether it replaces the Data code, the
          Draw rows or both. Nothing changes on your devices until you click Save &amp; deploy.
        </p>
        {error && <p className="text-[13px] text-[#ff8a8e]">Could not load your services: {error}</p>}
        {!services && !error && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading your services…
          </p>
        )}
        {services?.length === 0 && (
          <p className="text-[13px] text-muted">You don&apos;t have any services yet. Use the template to create one.</p>
        )}
        {services && services.length > 0 && (
          <ul role="radiogroup" aria-label="Services" className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === s.id}
                  onClick={() => setChosen(s.id)}
                  onDoubleClick={() => go(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-[13px] text-fg transition-colors",
                    chosen === s.id ? "border-accent bg-accent/5" : "border-border hover:border-border-strong hover:bg-panel-hover",
                  )}
                >
                  <span className="truncate">{s.name}</span>
                  {s.shared && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted">
                      <Users size={12} /> Shared
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
