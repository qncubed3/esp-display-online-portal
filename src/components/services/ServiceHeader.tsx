"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { deleteService, updateService } from "@/app/services/[id]/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";

export default function ServiceHeader({ serviceId, name, enabled }: { serviceId: string; name: string; enabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  function run(fn: () => Promise<void>, onError?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        onError?.();
      }
    });
  }

  function saveName(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    run(async () => {
      await updateService(serviceId, { name: next });
      setEditing(false);
    });
  }

  function toggle(next: boolean) {
    setIsEnabled(next);
    run(() => updateService(serviceId, { enabled: next }), () => setIsEnabled(!next));
  }

  function remove() {
    setError(null);
    startDelete(async () => {
      try {
        await deleteService(serviceId); // redirects to / on success
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                maxLength={100}
                className="h-8 w-72 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditing(false);
                    setDraft(name);
                  }
                }}
              />
              <Button type="submit" size="sm" variant="primary" disabled={pending} aria-label="Save name">
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Cancel"
                onClick={() => {
                  setEditing(false);
                  setDraft(name);
                }}
              >
                <X size={14} />
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              className="group flex min-w-0 cursor-pointer items-center gap-2 text-left"
              title="Rename"
            >
              <h1 className="truncate text-xl font-medium">{name}</h1>
              <Pencil size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <Badge variant={isEnabled ? "success" : "neutral"}>{isEnabled ? "Enabled" : "Disabled"}</Badge>
        </div>

        <div className="flex items-center gap-4">
          <Toggle checked={isEnabled} onChange={toggle} disabled={pending} label="Enabled" />
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-[13px] text-[#ff8a8e]">{error}</p>}

      <Dialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title="Delete service"
        footer={
          <>
            <Button size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={remove} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete service
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          Delete <span className="text-fg">{name}</span> and all of its devices? Devices using it will stop receiving
          frames. This can&apos;t be undone.
        </p>
      </Dialog>
    </div>
  );
}
