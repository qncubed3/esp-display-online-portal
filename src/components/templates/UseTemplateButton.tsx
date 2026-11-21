"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { createServiceFromTemplate } from "@/lib/templates/actions";
import { invalidateLists, isRedirect } from "@/lib/store/cache";

export default function UseTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(templateName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setName(templateName);
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the new service page.
      let res: { error: string } | undefined;
      try {
        res = await createServiceFromTemplate(templateId, name);
      } catch (e) {
        // Created: the Service lists don't have it yet.
        if (isRedirect(e)) invalidateLists("services", "subscribable");
        throw e;
      }
      if (res?.error) setError(res.error);
    });
  }

  const inputId = `template-name-${templateId}`;
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Copy size={13} />
        Use template
      </Button>
      <Dialog open={open} onClose={close} title={`New service from "${templateName}"`}>
        <form onSubmit={submit}>
          <Label htmlFor={inputId}>Name</Label>
          <Input
            id={inputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            maxLength={100}
          />
          <p className="mt-2 text-[12px] text-muted">
            The Data code and Draw ops are copied into the new service; edit them freely.
          </p>
          {error && <p className="mt-2 text-[13px] text-[#ff8a8e]">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button size="sm" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" type="submit" variant="primary" disabled={pending || !name.trim()}>
              {pending && <Loader2 size={14} className="animate-spin" />}
              Create service
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
