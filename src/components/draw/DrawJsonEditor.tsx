"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Check, Copy } from "lucide-react";
import { LINE_HEIGHT, MIN_LINES, PAD_Y } from "@/components/data/editorMetrics";
import type { DrawRow } from "@/lib/draw/ops";
import { formatWire, parseWireText, rowsToWire } from "@/lib/draw/wire";

const CodeEditor = dynamic(() => import("@/components/data/CodeEditor"), { ssr: false, loading: () => null });

const DEBOUNCE_MS = 300;

const toText = (rows: DrawRow[]) => formatWire(rowsToWire(rows));

// The Draw rows as the device's wire JSON (before {var} substitution), two-way synced:
// - rows -> text whenever rows change and the editor isn't focused (never moves the user's cursor);
// - text -> rows on each edit (debounced) when it parses and validates; otherwise the last valid
//   rows stay and the error shows under the editor, leaving the user's text alone.
export default function DrawJsonEditor({ rows, onChange }: { rows: DrawRow[]; onChange(rows: DrawRow[]): void }) {
  const [text, setText] = useState(() => toText(rows));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(textRef.current);
      setCopied(true);
    } catch {
      // Clipboard blocked; the user can still select the text in the editor.
    }
  }

  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const textRef = useRef(text);
  textRef.current = text;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (focused.current) return;
    setText(toText(rows));
    setError(null);
  }, [rows]);

  // Parse `value` and push it to the parent if it's valid and different. Returns the parse result.
  const apply = (value: string) => {
    timer.current = null;
    const res = parseWireText(value, rowsRef.current);
    if (!res.ok) {
      setError(res.error);
      return res;
    }
    setError(null);
    if (JSON.stringify(res.rows) !== JSON.stringify(rowsRef.current)) onChangeRef.current(res.rows);
    return res;
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // Flush a pending edit if the editor goes away (e.g. switching back to the row UI).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        applyRef.current(textRef.current);
      }
    },
    [],
  );

  function edit(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(value), DEBOUNCE_MS);
  }

  function blur() {
    focused.current = false;
    if (timer.current) clearTimeout(timer.current);
    const res = apply(textRef.current);
    // Valid: normalise the formatting. Invalid: keep what the user typed.
    if (res.ok) setText(toText(res.rows));
  }

  const lines = Math.max(MIN_LINES, text.split("\n").length);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Copied JSON" : "Copy JSON"}
        title={copied ? "Copied" : "Copy JSON"}
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-panel/90 text-muted outline-none transition-colors hover:border-border-strong hover:text-fg focus-visible:ring-1 focus-visible:ring-accent"
      >
        {copied ? <Check size={14} className="text-accent" aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      <div
        className={`overflow-hidden rounded-md border bg-[#121212] focus-within:ring-2 ${
          error ? "border-danger/60 focus-within:ring-danger/30" : "border-border focus-within:border-border-strong focus-within:ring-accent/30"
        }`}
        style={{ minHeight: lines * LINE_HEIGHT + 2 * PAD_Y + 2 }}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) blur();
        }}
      >
        <CodeEditor value={text} onChange={edit} language="json" placeholder='[["fillScreen", "#000000"]]' />
      </div>
      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-[#ff8a8e]" role="alert">
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {error}
            <span className="block text-muted">The rows keep their last valid state until this is fixed.</span>
          </span>
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-muted">
          The JSON sent to devices, before <code className="font-mono text-fg">{"{var}"}</code> substitution. One{" "}
          <code className="font-mono text-fg">[&quot;op&quot;, args…]</code> per line; edits apply as you type.
        </p>
      )}
    </div>
  );
}
