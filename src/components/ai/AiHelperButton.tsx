"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

// "AI helper" button + dialog that shows a ready-made skill/prompt to copy into Claude (or any AI).
// `buildSkill` is called when the dialog opens, so it can include live state (e.g. current variables).
export default function AiHelperButton({
  buildSkill,
  title = "AI helper",
  intro,
  label = "AI helper",
  fileName = "SKILL.md",
}: {
  buildSkill(): string;
  title?: string;
  intro: ReactNode;
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

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setSkill(buildSkill());
          setCopied(null);
          setOpen(true);
        }}
        title="Get a prompt to paste into Claude or another AI"
      >
        <Sparkles size={14} className="text-accent" />
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        className="max-w-3xl"
        footer={
          <>
            {copied === "fail" && <span className="mr-auto self-center text-[13px] text-[#ff8a8e]">Copy failed; select the text and copy it.</span>}
            <Button size="sm" onClick={download}>
              <Download size={14} />
              Download {fileName}
            </Button>
            <Button size="sm" variant="primary" onClick={() => void copy()}>
              {copied === "ok" ? <Check size={14} /> : <Copy size={14} />}
              {copied === "ok" ? "Copied" : "Copy prompt"}
            </Button>
          </>
        }
      >
        <div className="mb-3 text-[13px] text-muted">{intro}</div>
        <pre
          tabIndex={0}
          aria-label="Prompt"
          className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-[#121212] p-3 font-mono text-[12px] leading-5 text-fg focus:border-border-strong focus:outline-none"
        >
          {skill}
        </pre>
      </Dialog>
    </>
  );
}
