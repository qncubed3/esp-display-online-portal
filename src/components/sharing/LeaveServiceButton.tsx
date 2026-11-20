"use client";

import { useState, useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { leaveService } from "@/lib/sharing/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

// For members: leave a Service shared with you (confirm first).
export default function LeaveServiceButton({ serviceId, name }: { serviceId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function leave() {
    setError(null);
    startTransition(async () => {
      try {
        await leaveService(serviceId); // redirects to / on success
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not leave.");
      }
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <LogOut size={14} />
        Leave
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Leave service"
        footer={
          <>
            <Button size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={leave} disabled={pending}>
              {pending && <Loader2 size={14} className="animate-spin" />}
              Leave service
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          Leave <span className="text-fg">{name}</span>? You&apos;ll lose access until the owner adds you again.
        </p>
        {error && <p className="mt-2 text-[13px] text-[#ff8a8e]">{error}</p>}
      </Dialog>
    </>
  );
}
