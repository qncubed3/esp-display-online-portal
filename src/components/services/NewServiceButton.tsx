"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { createService } from "@/app/actions";
import { invalidateLists, isRedirect } from "@/lib/store/cache";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";

export default function NewServiceButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setName("");
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the new service page.
      let res: { error: string } | undefined;
      try {
        res = await createService(name);
      } catch (e) {
        // Created: the Service lists don't have it yet.
        if (isRedirect(e)) invalidateLists("services", "subscribable");
        throw e;
      }
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      <Button variant="primary" size={size} onClick={() => setOpen(true)}>
        <Plus size={14} />
        New service
      </Button>
      <Dialog open={open} onClose={close} title="New service">
        <form onSubmit={submit}>
          <Label htmlFor="service-name">Name</Label>
          <Input
            id="service-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitchen weather"
            autoFocus
            maxLength={100}
          />
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
