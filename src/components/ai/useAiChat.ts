"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawRow } from "@/lib/draw/ops";
import { wireToRows, type RawWireOp } from "@/lib/draw/wire";

type Vars = Record<string, string | number | boolean>;

/** How much the model thinks before answering (matches the server's Effort). */
export type Effort = "off" | "low" | "medium" | "high";
export const EFFORT_OPTIONS: { value: Effort; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const EFFORT_KEY = "ai-chat-effort";

export interface EditorState {
  code: string;
  rows: DrawRow[];
  vars: Vars;
}

export interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  /** Which sections this reply changed. */
  changed?: { data: boolean; draw: boolean };
  /** Editor state before this reply was applied, for Undo. */
  before?: { code: string; rows: DrawRow[] };
  undone?: boolean;
  /** A failed request or an invalid block; not sent back to the model. */
  error?: string;
  /** The reply is still arriving; `progress` says what's being written. */
  streaming?: boolean;
  progress?: string;
  /** Who sent a user message, when it was someone else (the chat is shared per Service). */
  author?: string | null;
}

type SavedMessage = {
  role: "user" | "assistant";
  content: string;
  changed: { data: boolean; draw: boolean } | null;
  author: string | null;
  mine: boolean;
};

type Done = { text?: string; dataCode?: string; wire?: RawWireOp[]; drawError?: string; model?: string };
type ServerEvent =
  | { type: "attempt"; model: string }
  | { type: "text"; delta: string }
  | { type: "status"; text: string }
  | ({ type: "done" } & Done)
  | { type: "error"; error: string };

// What a half-written reply shows: the text so far, with finished code blocks hidden and the one
// being written summarised ("Writing Draw… 12 lines").
function streamPreview(raw: string): { text: string; progress?: string } {
  let text = raw.replace(/```(json|javascript|js)[^\n]*\n[\s\S]*?```/gi, "");
  let progress: string | undefined;
  const open = text.indexOf("```");
  if (open >= 0) {
    const block = text.slice(open);
    const what = /^```json/i.test(block) ? "Draw" : "Data code";
    const lines = Math.max(0, block.split("\n").length - 1);
    progress = `Writing ${what}… ${lines} ${lines === 1 ? "line" : "lines"}`;
    text = text.slice(0, open);
  }
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), progress };
}

// Chat state and the request loop. Lives in the editor (not the Draw tab) so the conversation
// survives tab switches. The chat is saved on the server per Service and shared by everyone with
// access; it loads when the editor opens. Undo only covers replies applied in this session.
// `getState` reads the editor's latest state; `apply` writes changes into it.
export function useAiChat({
  serviceId,
  getState,
  apply,
}: {
  serviceId: string;
  getState(): EditorState;
  apply(change: { code?: string; rows?: DrawRow[] }): void;
}) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  /** The configured model, then whichever model answered last (a fallback shows here). */
  const [model, setModel] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [effort, setEffortState] = useState<Effort>("off");
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EFFORT_KEY);
      if (saved && EFFORT_OPTIONS.some((o) => o.value === saved)) setEffortState(saved as Effort);
    } catch {
      // Storage unavailable: keep the default.
    }
    fetch(`/api/ai/chat?serviceId=${encodeURIComponent(serviceId)}`)
      .then((r) => r.json())
      .then((b: { model?: string | null; messages?: SavedMessage[] }) => {
        setModel((m) => m ?? b.model ?? null);
        const saved: ChatEntry[] = (b.messages ?? []).map((m) => ({
          role: m.role,
          content: m.content,
          changed: m.changed ?? undefined,
          author: m.mine ? null : m.author,
        }));
        // Don't replace a conversation already started in this session.
        if (saved.length) setEntries((prev) => (prev.length ? prev : saved));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [serviceId]);

  const setEffort = useCallback((value: Effort) => {
    setEffortState(value);
    try {
      localStorage.setItem(EFFORT_KEY, value);
    } catch {
      // Not remembered; fine.
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || pending) return;
      const history = [...entriesRef.current.filter((e) => !e.error && !e.streaming), { role: "user" as const, content }];
      setEntries((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "", streaming: true }]);
      setPending(true);

      // Updates the in-progress reply (always the last entry while pending).
      const updateStreaming = (patch: Partial<ChatEntry>) =>
        setEntries((prev) => prev.map((e, i) => (i === prev.length - 1 && e.streaming ? { ...e, ...patch } : e)));
      const finish = (final: ChatEntry[]) =>
        setEntries((prev) => [...prev.filter((e, i) => !(i === prev.length - 1 && e.streaming)), ...final]);

      try {
        const state = getState();
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            effort,
            code: state.code,
            rows: state.rows,
            vars: state.vars,
            // Code isn't repeated in the history (the current code goes with the latest message); note what changed instead.
            messages: history.map((e) => ({
              role: e.role,
              content: e.changed ? `${e.content}\n[Applied to: ${[e.changed.data && "Data", e.changed.draw && "Draw"].filter(Boolean).join(", ")}]` : e.content,
            })),
          }),
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          // A bare 504 (no JSON) is the platform's own timeout.
          const fallback = res.status === 504 ? "The AI took too long to reply. Try again, or ask for a smaller change." : `Request failed (HTTP ${res.status})`;
          throw new Error(body.error ?? fallback);
        }

        let raw = "";
        let done: Done | null = null;
        const handle = (ev: ServerEvent) => {
          if (ev.type === "attempt") {
            raw = "";
            setModel(ev.model);
            updateStreaming({ content: "", progress: undefined });
          } else if (ev.type === "text") {
            raw += ev.delta;
            const p = streamPreview(raw);
            updateStreaming({ content: p.text, progress: p.progress });
          } else if (ev.type === "status") {
            updateStreaming({ progress: ev.text });
          } else if (ev.type === "done") {
            done = ev;
          } else if (ev.type === "error") {
            throw new Error(ev.error);
          }
        };

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          buffer += value;
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) handle(JSON.parse(line) as ServerEvent);
          }
        }
        if (buffer.trim()) handle(JSON.parse(buffer) as ServerEvent);
        const result = done as Done | null;
        if (!result) throw new Error("The reply was cut off. Try again.");
        if (result.model) setModel(result.model);

        const latest = getState();
        const parsed = result.wire ? wireToRows(result.wire, latest.rows) : undefined;
        const rows = parsed?.ok ? parsed.rows : undefined;
        const changed = { data: result.dataCode !== undefined && result.dataCode !== latest.code, draw: rows !== undefined };
        const any = changed.data || changed.draw;
        if (any) apply({ code: changed.data ? result.dataCode : undefined, rows });
        finish([
          {
            role: "assistant",
            content: result.text ?? "",
            changed: any ? changed : undefined,
            before: any ? { code: latest.code, rows: latest.rows } : undefined,
          },
          ...(result.drawError ? [{ role: "assistant" as const, content: "", error: `Draw changes skipped, the JSON was invalid: ${result.drawError}` }] : []),
        ]);
      } catch (e) {
        finish([{ role: "assistant", content: "", error: e instanceof Error ? e.message : "Request failed." }]);
      } finally {
        setPending(false);
      }
    },
    [pending, serviceId, effort, getState, apply],
  );

  const undo = useCallback(
    (index: number) => {
      const entry = entriesRef.current[index];
      if (!entry?.before || entry.undone) return;
      apply({ code: entry.before.code, rows: entry.before.rows });
      setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, undone: true } : e)));
    },
    [apply],
  );

  // Clears the saved chat for everyone with access to the Service.
  const clear = useCallback(async () => {
    const res = await fetch(`/api/ai/chat?serviceId=${encodeURIComponent(serviceId)}`, { method: "DELETE" }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setEntries((prev) => [...prev, { role: "assistant", content: "", error: body?.error ?? "Could not clear the chat." }]);
      return;
    }
    setEntries([]);
  }, [serviceId]);

  return { entries, pending, loaded, send, undo, clear, model, effort, setEffort };
}

export type AiChatState = ReturnType<typeof useAiChat>;
