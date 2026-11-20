"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Code2, Loader2, Shapes, Sparkles, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { AiChatState } from "./useAiChat";

const SUGGESTIONS = [
  "Show the Bitcoin price from CoinGecko, big and centred",
  "Add a header bar with a clock on the right",
  "Make the colour scheme dark blue",
];

// The AI assistant panel under the Draw preview. Replies are applied to the editor straight away
// (unsaved until Save & deploy); the latest change can be undone.
export default function AiChat({ chat }: { chat: AiChatState }) {
  const { entries, pending, send, undo, clear } = chat;
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, pending]);

  const lastApplied = entries.findLastIndex((e) => e.before && !e.undone);

  const submit = (text = draft) => {
    if (!text.trim() || pending) return;
    void send(text);
    setDraft("");
  };

  return (
    <section aria-label="AI assistant" className="flex min-w-0 flex-col rounded-md border border-border bg-bg">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-3">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <Sparkles size={14} className="text-accent" aria-hidden /> AI assistant
        </h3>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-muted outline-none transition-colors hover:text-fg focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            <Trash2 size={12} aria-hidden /> Clear
          </button>
        )}
      </div>

      <div ref={listRef} className="max-h-80 min-h-0 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {entries.length === 0 && (
          <div className="space-y-2.5">
            <p className="text-[12px] text-muted">
              Describe the screen you want. The assistant can rewrite both the Data code and the Draw ops; changes land in the
              editor unsaved, so check the preview, then Save &amp; deploy.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-border bg-panel px-2.5 py-1 text-left text-[12px] text-muted outline-none transition-colors hover:border-border-strong hover:text-fg focus-visible:ring-1 focus-visible:ring-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {entries.map((e, i) =>
          e.error ? (
            <p key={i} className="flex items-start gap-1.5 text-[12px] text-[#ff8a8e]">
              <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{e.error}</span>
            </p>
          ) : e.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-panel-hover px-2.5 py-1.5 text-[13px]">{e.content}</p>
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {e.content && <p className="whitespace-pre-wrap break-words text-[13px] text-fg">{e.content}</p>}
              {e.changed && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {e.changed.data && (
                    <span className={cn("inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5", e.undone ? "text-muted line-through" : "text-accent")}>
                      <Code2 size={11} aria-hidden /> Data updated
                    </span>
                  )}
                  {e.changed.draw && (
                    <span className={cn("inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5", e.undone ? "text-muted line-through" : "text-accent")}>
                      <Shapes size={11} aria-hidden /> Draw updated
                    </span>
                  )}
                  {i === lastApplied && (
                    <button
                      type="button"
                      onClick={() => undo(i)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted outline-none transition-colors hover:text-fg focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
                    >
                      <Undo2 size={11} aria-hidden /> Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          ),
        )}

        {pending && (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Loader2 size={13} className="animate-spin" aria-hidden /> Thinking…
          </p>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Ask for a change… (Enter to send, Shift+Enter for a new line)"
          aria-label="Message the AI assistant"
          className="min-h-[52px] min-w-0 flex-1 resize-y rounded-md border border-border bg-panel px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          aria-label="Send"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-[#111] outline-none transition-[opacity,background-color] hover:bg-accent-hover focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
        </button>
      </form>
    </section>
  );
}
