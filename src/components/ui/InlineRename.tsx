"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "./cn";

// A name with a pencil button that turns it into a text field in place. Enter or clicking away
// saves, Escape cancels. The new name shows straight away; on failure it reverts and the error
// is shown as the pencil's tooltip.
export function InlineRename({
  value,
  onSave,
  label = "Rename",
  maxLength = 100,
  className,
}: {
  value: string;
  onSave(name: string): Promise<void>;
  label?: string;
  maxLength?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing && !saving) setShown(value);
  }, [value, editing, saving]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(shown);
    setError(null);
    setEditing(true);
  };

  async function commit() {
    if (!editing) return;
    setEditing(false);
    const next = draft.trim();
    if (!next || next === shown) return;
    const previous = shown;
    setShown(next);
    setSaving(true);
    try {
      await onSave(next);
    } catch (e) {
      setShown(previous);
      setError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        maxLength={maxLength}
        aria-label={label}
        className={cn(
          "h-7 w-full min-w-0 max-w-[16rem] rounded-md border border-accent bg-bg px-2 text-[13px] text-fg outline-none",
          className,
        )}
      />
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className={cn("truncate", error && "text-[#ff8a8e]")} title={shown}>
        {shown}
      </span>
      <button
        type="button"
        onClick={start}
        disabled={saving}
        title={error ? `Rename failed: ${error}` : label}
        aria-label={label}
        className={cn(
          "shrink-0 rounded p-1 text-muted outline-none transition-colors hover:bg-panel-hover hover:text-fg focus-visible:ring-1 focus-visible:ring-accent",
          error && "text-[#ff8a8e]",
        )}
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
      </button>
    </span>
  );
}
