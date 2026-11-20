"use client";

import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { createSecret, deleteSecret, revealSecret, updateSecret, type SecretRow } from "@/lib/secrets/actions";
import { normalizeSecretName, secretNameError, secretValueError } from "@/lib/secrets/name";
import { timeAgo } from "@/lib/time";

const MASK = "••••••";

type Editing = { mode: "add" } | { mode: "edit"; name: string } | null;

function without(map: Record<string, string>, key: string): Record<string, string> {
  const next = { ...map };
  delete next[key];
  return next;
}

// List + add/edit/delete for the signed-in user's secrets. Values stay on the server until the
// user reveals or copies one.
export default function SecretsManager({ initial }: { initial: SecretRow[] }) {
  const [secrets, setSecrets] = useState<SecretRow[]>(initial);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // "<action>:<name>"
  const [copied, setCopied] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => setSecrets(initial), [initial]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function fetchValue(name: string): Promise<string | null> {
    if (revealed[name] !== undefined) return revealed[name];
    try {
      const res = await revealSecret(name);
      if (res.error !== undefined) {
        setRowError(res.error);
        return null;
      }
      return res.value;
    } catch {
      setRowError("Could not load the value.");
      return null;
    }
  }

  async function toggleReveal(name: string) {
    setRowError(null);
    if (revealed[name] !== undefined) {
      setRevealed((r) => without(r, name));
      return;
    }
    setBusy(`reveal:${name}`);
    const value = await fetchValue(name);
    setBusy(null);
    if (value !== null) setRevealed((r) => ({ ...r, [name]: value }));
  }

  async function copy(name: string) {
    setRowError(null);
    setBusy(`copy:${name}`);
    const value = await fetchValue(name);
    setBusy(null);
    if (value === null) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(name);
    } catch {
      setRowError("Could not copy to the clipboard.");
    }
  }

  function saved(row: SecretRow, value: string) {
    setSecrets((list) => [...list.filter((s) => s.name !== row.name), row].sort((a, b) => a.name.localeCompare(b.name)));
    // Keep a revealed value in sync with the edit; otherwise stay masked.
    setRevealed((r) => (r[row.name] !== undefined ? { ...r, [row.name]: value } : r));
    setEditing(null);
  }

  function removed(name: string) {
    setSecrets((list) => list.filter((s) => s.name !== name));
    setRevealed((r) => without(r, name));
    setDeleting(null);
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">
          {secrets.length} {secrets.length === 1 ? "secret" : "secrets"}
        </h2>
        {secrets.length > 0 && (
          <Button variant="primary" size="sm" onClick={() => setEditing({ mode: "add" })}>
            <Plus size={14} />
            Add secret
          </Button>
        )}
      </div>

      {rowError && (
        <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-[#ff8a8e]">{rowError}</p>
      )}

      {secrets.length === 0 ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-border bg-panel px-4 py-14 text-center sm:px-6">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted">
            <KeyRound size={18} />
          </span>
          <h3 className="mb-1 text-sm font-medium">No secrets yet</h3>
          <p className="mb-5 max-w-sm text-[13px] text-muted">
            Store API keys here instead of pasting them into Data code, e.g.{" "}
            <code className="font-mono">WEATHER_KEY</code>.
          </p>
          <Button variant="primary" onClick={() => setEditing({ mode: "add" })}>
            <Plus size={14} />
            Add secret
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-panel">
          <table className="w-full min-w-[560px] table-fixed text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted">
                <th className="w-[32%] px-4 py-2 font-normal">Name</th>
                <th className="px-4 py-2 font-normal">Value</th>
                <th className="w-32 px-4 py-2 font-normal">Updated</th>
                <th className="w-24 px-4 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((s) => {
                const shown = revealed[s.name];
                return (
                  <tr key={s.name} className="border-b border-border last:border-0">
                    <td className="truncate px-4 py-2 font-mono" title={s.name}>
                      {s.name}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <span
                          className={`min-w-0 flex-1 truncate font-mono ${shown === undefined ? "text-muted" : ""}`}
                          title={shown}
                        >
                          {shown ?? MASK}
                        </span>
                        <IconButton
                          label={shown === undefined ? `Reveal ${s.name}` : `Hide ${s.name}`}
                          busy={busy === `reveal:${s.name}`}
                          onClick={() => toggleReveal(s.name)}
                        >
                          {shown === undefined ? <Eye size={14} /> : <EyeOff size={14} />}
                        </IconButton>
                        <IconButton label={`Copy ${s.name}`} busy={busy === `copy:${s.name}`} onClick={() => copy(s.name)}>
                          {copied === s.name ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
                        </IconButton>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted" title={new Date(s.updated_at).toLocaleString()}>
                      {timeAgo(s.updated_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <IconButton label={`Edit ${s.name}`} onClick={() => setEditing({ mode: "edit", name: s.name })}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label={`Delete ${s.name}`} onClick={() => setDeleting(s.name)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SecretDialog
        key={editing ? (editing.mode === "edit" ? `edit:${editing.name}` : "add") : "closed"}
        editing={editing}
        existing={secrets.map((s) => s.name)}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
      <DeleteDialog key={deleting ?? "none"} name={deleting} onClose={() => setDeleting(null)} onDeleted={removed} />
    </>
  );
}

function IconButton({
  label,
  busy,
  onClick,
  children,
}: {
  label: string;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-hover hover:text-fg disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}

function SecretDialog({
  editing,
  existing,
  onClose,
  onSaved,
}: {
  editing: Editing;
  existing: string[];
  onClose: () => void;
  onSaved: (row: SecretRow, value: string) => void;
}) {
  const isEdit = editing?.mode === "edit";
  const [name, setName] = useState(editing?.mode === "edit" ? editing.name : "");
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameProblem = isEdit
    ? null
    : (secretNameError(name) ?? (existing.includes(name) ? `${name} already exists. Edit it instead.` : null));
  const valueProblem = secretValueError(value.trim());

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (nameProblem || valueProblem) return;
    startTransition(async () => {
      try {
        const res = isEdit ? await updateSecret(name, value) : await createSecret(name, value);
        if (res.error !== undefined || !res.secret) {
          setError(res.error ?? "Could not save.");
          return;
        }
        onSaved(res.secret, value.trim());
      } catch {
        setError("Could not save.");
      }
    });
  }

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={isEdit ? `Edit ${name}` : "Add secret"}
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" form="secret-form" disabled={pending}>
            {pending && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <form id="secret-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="secret-name">Name</Label>
          <Input
            id="secret-name"
            value={name}
            onChange={(e) => setName(normalizeSecretName(e.target.value))}
            placeholder="WEATHER_KEY"
            className="font-mono"
            disabled={isEdit}
            autoFocus={!isEdit}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
          />
          {touched && nameProblem ? (
            <p className="mt-1 text-[12px] text-[#ff8a8e]">{nameProblem}</p>
          ) : (
            <p className="mt-1 text-[12px] text-muted">
              A-Z, 0-9 and _, starting with a letter. Read it in Data code as{" "}
              <code className="font-mono">secrets.{name || "NAME"}</code>.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="secret-value">{isEdit ? "New value" : "Value"}</Label>
          <Textarea
            id="secret-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            className="resize-none font-mono"
            autoFocus={isEdit}
            autoComplete="off"
            spellCheck={false}
          />
          {touched && valueProblem && <p className="mt-1 text-[12px] text-[#ff8a8e]">{valueProblem}</p>}
        </div>
        {error && <p className="text-[13px] text-[#ff8a8e]">{error}</p>}
      </form>
    </Dialog>
  );
}

function DeleteDialog({
  name,
  onClose,
  onDeleted,
}: {
  name: string | null;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteSecret(name);
        if (res.error !== undefined) {
          setError(res.error);
          return;
        }
        onDeleted(name);
      } catch {
        setError("Could not delete.");
      }
    });
  }

  return (
    <Dialog
      open={name !== null}
      onClose={onClose}
      title="Delete secret"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={confirm} disabled={pending}>
            {pending && <Loader2 size={14} className="animate-spin" />}
            Delete
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted">
        Delete <code className="font-mono text-fg">{name}</code>? Any Service whose Data code reads{" "}
        <code className="font-mono">secrets.{name}</code> will get <code className="font-mono">undefined</code> instead.
      </p>
      {error && <p className="mt-3 text-[13px] text-[#ff8a8e]">{error}</p>}
    </Dialog>
  );
}
