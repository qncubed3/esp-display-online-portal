"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { saveDataCode } from "@/app/services/[id]/actions";
import { Button } from "@/components/ui/Button";

const PLACEHOLDER = `// Data section: runs before each frame. Variables you set here
// can be used in Draw rows as {name}.
`;

export default function DataEditor({ serviceId, initialCode }: { serviceId: string; initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [savedCode, setSavedCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = code !== savedCode;

  function save() {
    if (!dirty || pending) return;
    const toSave = code;
    setError(null);
    startTransition(async () => {
      try {
        await saveDataCode(serviceId, toSave);
        setSavedCode(toSave);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
    } else if (e.key === "Tab" && !e.shiftKey) {
      // Insert two spaces instead of moving focus.
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: start, selectionEnd: end } = el;
      const next = code.slice(0, start) + "  " + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">
          JavaScript that produces the variables used by the Draw section. <kbd className="font-mono">Ctrl+S</kbd> to
          save.
        </p>
        <div className="flex items-center gap-3">
          {error ? (
            <span className="text-[13px] text-[#ff8a8e]">{error}</span>
          ) : dirty ? (
            <span className="text-[13px] text-muted">Unsaved changes</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[13px] text-muted">
              <Check size={13} /> Saved
            </span>
          )}
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty || pending}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
        </div>
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="min-h-[420px] w-full resize-y rounded-md border border-border bg-[#121212] p-4 font-mono text-[13px] leading-relaxed text-fg placeholder:text-muted/50 focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}
