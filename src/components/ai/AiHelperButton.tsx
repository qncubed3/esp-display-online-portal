"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

// "AI helper" button + dialog that shows a ready-made skill/prompt to copy into ChatGPT or Claude.
// `buildSkill` is called when the dialog opens, so it can include live state (e.g. current variables).
// `pasteStep` is the dialog-specific "where to paste the reply" step.
export default function AiHelperButton({
  buildSkill,
  title = "AI helper",
  pasteStep,
  label = "AI helper",
  fileName = "SKILL.md",
}: {
  buildSkill(): string;
  title?: string;
  pasteStep: ReactNode;
  label?: string;
  fileName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState("");
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(skill);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([skill], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const link = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {text}
    </a>
  );

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setSkill(buildSkill());
          setCopied(null);
          setOpen(true);
        }}
        title="Get a prompt to paste into ChatGPT or Claude"
      >
        <Sparkles size={14} className="text-accent" />
        {label}
      </Button>
      {/* Fixed height so the dialog itself never scrolls; only the prompt box does. */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        className="h-[85vh] max-h-[85vh] max-w-3xl overflow-hidden open:flex open:flex-col"
        bodyClassName="flex min-h-0 flex-1 flex-col"
        footer={
          <Button size="sm" onClick={download}>
            <Download size={14} />
            Download {fileName}
          </Button>
        }
      >
        <ol className="mb-3 list-decimal space-y-0.5 pl-5 text-[12px] leading-5 text-muted marker:text-muted">
          <li>Copy the prompt below.</li>
          <li>
            Paste it into a new chat on {link("https://chatgpt.com", "chatgpt.com")} or {link("https://claude.ai", "claude.ai")},
            then describe what you want and add your API URLs.
          </li>
          <li>{pasteStep}</li>
        </ol>
        <div className="relative min-h-0 flex-1">
          <pre
            tabIndex={0}
            aria-label="Prompt"
            className="h-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-[#121212] p-3 pr-14 font-mono text-[12px] leading-5 text-fg focus:border-border-strong focus:outline-none"
          >
            {skill}
          </pre>
          {/* right-6 leaves room for the box's scrollbar, so the button never sits on top of it. */}
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied === "ok" ? "Copied" : "Copy prompt"}
            title={copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed; select the text and copy it" : "Copy prompt"}
            className={`absolute right-6 top-2.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              copied === "ok" ? "text-accent" : copied === "fail" ? "text-[#ff8a8e]" : "text-muted hover:text-fg"
            }`}
          >
            {copied === "ok" ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </Dialog>
    </>
  );
}
