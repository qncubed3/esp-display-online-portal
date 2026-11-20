"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the text is still selectable.
    }
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <code className="truncate rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[12px] text-muted select-all">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        title={copied ? "Copied" : "Copy"}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-panel-hover hover:text-fg"
      >
        {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
      </button>
    </span>
  );
}
