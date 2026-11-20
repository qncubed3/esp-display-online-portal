"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

// Step-by-step guide for someone using ChatGPT or Claude in a web browser (no Claude Code, no skills).
// `pasteStep` is the dialog-specific "where to paste the reply" step.
function HowToUse({ pasteStep, fileName }: { pasteStep: ReactNode; fileName: string }) {
  const code = (t: string) => <code className="font-mono text-fg">{t}</code>;
  return (
    <div className="mb-3 rounded-md border border-border bg-bg px-3 py-2.5 text-[12px] leading-5 text-muted">
      <div className="mb-1 font-medium text-fg">How to use this with ChatGPT or Claude in your browser</div>
      <ol className="list-decimal space-y-0.5 pl-5 marker:text-muted">
        <li>
          Click <span className="text-fg">Copy prompt</span> below.
        </li>
        <li>
          Open{" "}
          <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            chatgpt.com
          </a>{" "}
          or{" "}
          <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            claude.ai
          </a>{" "}
          and start a new chat.
        </li>
        <li>
          Paste the prompt as your first message. Then, in the same or the next message, describe what you want and give
          your API URLs. If you can, also paste a sample API response (open the URL in your browser and copy the text).
        </li>
        <li>{pasteStep}</li>
        <li>
          Click {code("Run")} / check the preview. If something&apos;s off, paste the error or describe the problem back
          to the AI.
        </li>
      </ol>
      <p className="mt-1.5">
        Advanced: on claude.ai you can upload the downloaded {code(fileName)} as a skill (Settings → Capabilities →
        Skills) or add it to a Project&apos;s knowledge, so you don&apos;t have to paste it every time.
      </p>
    </div>
  );
}

// "AI helper" button + dialog that shows a ready-made skill/prompt to copy into Claude (or any AI).
// `buildSkill` is called when the dialog opens, so it can include live state (e.g. current variables).
export default function AiHelperButton({
  buildSkill,
  title = "AI helper",
  intro,
  pasteStep,
  label = "AI helper",
  fileName = "SKILL.md",
}: {
  buildSkill(): string;
  title?: string;
  intro: ReactNode;
  /** Step 4 of the "how to use" guide: where to paste the AI's reply. Omit to hide the guide. */
  pasteStep?: ReactNode;
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
        {pasteStep && <HowToUse pasteStep={pasteStep} fileName={fileName} />}
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
