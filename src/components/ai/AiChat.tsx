"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowUp, Code2, Loader2, Shapes, Sparkles, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { EFFORT_OPTIONS, type AiChatState } from "./useAiChat";

const SUGGESTIONS = [
  "Show the Bitcoin price from CoinGecko, big and centred",
  "Add a header bar with a clock on the right",
  "Make the colour scheme dark blue",
];

// The AI assistant: the "AI" view of the Draw commands panel. Replies are applied to the editor straight away
// (unsaved until Save & deploy); the latest change can be undone.
export default function AiChat({ chat, headerActions }: { chat: AiChatState; /** Extra buttons in the header row. */ headerActions?: ReactNode }) {
  const { entries, pending, loaded, send, undo, clear, model, effort, setEffort } = chat;
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, pending, entries.at(-1)?.content, entries.at(-1)?.progress]);

  const lastApplied = entries.findLastIndex((e) => e.before && !e.undone);

  const submit = (text = draft) => {
    if (!text.trim() || pending) return;
    void send(text);
    setDraft("");
  };

  return (
    <section aria-label="AI assistant" className="flex min-w-0 flex-col rounded-md border border-border bg-bg">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium">
            <Sparkles size={14} className="text-accent" aria-hidden /> AI assistant
          </h3>
          {model && (
            <span
              className="min-w-0 truncate rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-[11px] text-muted"
              title={`Model: ${model}`}
            >
              {model}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear this chat for everyone with access to this service?")) void clear();
              }}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-muted outline-none transition-colors hover:text-fg focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
            >
              <Trash2 size={12} aria-hidden /> Clear
            </button>
          )}
          {headerActions}
        </div>
      </div>

      <div ref={listRef} className="max-h-[26rem] min-h-0 flex-1 space-y-3 overflow-y-auto xl:max-h-none px-3 py-3" aria-live="polite">
        {!loaded && entries.length === 0 && (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Loader2 size={13} className="animate-spin" aria-hidden /> Loading chat…
          </p>
        )}

        {loaded && entries.length === 0 && (
          <div className="space-y-2.5">
            <p className="text-[12px] text-muted">
              Describe the screen you want. The assistant can rewrite both the Data code and the Draw ops; changes land in the
              editor unsaved, so check the preview, then Save &amp; deploy. This chat is saved and shared with everyone who
              has access to this service.
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
            <div key={i} className="flex flex-col items-end gap-0.5">
              {e.author && <span className="max-w-[85%] truncate text-[11px] text-muted">{e.author}</span>}
              <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-panel-hover px-2.5 py-1.5 text-[13px]">{e.content}</p>
            </div>
          ) : (
            <div key={i} className="space-y-1.5">
              {e.content && <p className="whitespace-pre-wrap break-words text-[13px] text-fg">{e.content}</p>}
              {e.streaming && (
                <p className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> {e.progress ?? (e.content ? "Writing…" : "Thinking…")}
                </p>
              )}
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

      </div>

      <form
        className="space-y-1.5 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative">
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
            placeholder="Ask for a change…"
            aria-label="Message the AI assistant"
            className="block min-h-[52px] w-full resize-y rounded-md border border-border bg-panel py-1.5 pl-2.5 pr-12 text-[13px] text-fg outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending}
            aria-label="Send"
            // Inside the text box, vertically centred.
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-accent text-[#111] outline-none transition-[opacity,background-color] hover:bg-accent-hover focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span title="How much the model thinks before answering. Off is fastest and cheapest; higher is more careful but slower.">
            Thinking
          </span>
          <div role="radiogroup" aria-label="Thinking effort" className="inline-flex rounded-md border border-border bg-panel p-0.5">
            {EFFORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={effort === o.value}
                onClick={() => setEffort(o.value)}
                className={cn(
                  "rounded px-2 py-0.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-accent",
                  effort === o.value ? "bg-panel-hover text-fg" : "hover:text-fg",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="ml-auto hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
        </div>
      </form>
    </section>
  );
}
