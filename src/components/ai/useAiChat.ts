"use client";

import { useCallback, useRef, useState } from "react";
import type { DrawRow } from "@/lib/draw/ops";
import { wireToRows, type RawWireOp } from "@/lib/draw/wire";

type Vars = Record<string, string | number | boolean>;

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
}

// Chat state and the request loop. Lives in the editor (not the Draw tab) so the conversation
// survives tab switches. `getState` reads the editor's latest state; `apply` writes changes into it.
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
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || pending) return;
      const history = [...entriesRef.current.filter((e) => !e.error), { role: "user" as const, content }];
      setEntries((prev) => [...prev, { role: "user", content }]);
      setPending(true);
      try {
        const state = getState();
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            code: state.code,
            rows: state.rows,
            vars: state.vars,
            // Code isn't repeated in the history (the current code is in the prompt); note what changed instead.
            messages: history.map((e) => ({
              role: e.role,
              content: e.changed ? `${e.content}\n[Applied to: ${[e.changed.data && "Data", e.changed.draw && "Draw"].filter(Boolean).join(", ")}]` : e.content,
            })),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          text?: string;
          dataCode?: string;
          wire?: RawWireOp[];
          drawError?: string;
          error?: string;
        };
        if (!res.ok || body.error) {
          // A bare 504 (no JSON) is the platform's own timeout.
          const fallback = res.status === 504 ? "The AI took too long to reply. Try again, or ask for a smaller change." : `Request failed (HTTP ${res.status})`;
          throw new Error(body.error ?? fallback);
        }

        const latest = getState();
        const parsed = body.wire ? wireToRows(body.wire, latest.rows) : undefined;
        const rows = parsed?.ok ? parsed.rows : undefined;
        const changed = { data: body.dataCode !== undefined && body.dataCode !== latest.code, draw: rows !== undefined };
        const any = changed.data || changed.draw;
        if (any) apply({ code: changed.data ? body.dataCode : undefined, rows });
        setEntries((prev) => [
          ...prev,
          {
            role: "assistant",
            content: body.text ?? "",
            changed: any ? changed : undefined,
            before: any ? { code: latest.code, rows: latest.rows } : undefined,
          },
          ...(body.drawError ? [{ role: "assistant" as const, content: "", error: `Draw changes skipped, the JSON was invalid: ${body.drawError}` }] : []),
        ]);
      } catch (e) {
        setEntries((prev) => [...prev, { role: "assistant", content: "", error: e instanceof Error ? e.message : "Request failed." }]);
      } finally {
        setPending(false);
      }
    },
    [pending, serviceId, getState, apply],
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

  const clear = useCallback(() => setEntries([]), []);

  return { entries, pending, send, undo, clear };
}

export type AiChatState = ReturnType<typeof useAiChat>;
