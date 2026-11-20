// Prompt and reply handling for the in-editor AI chat. The model sees the full service-builder
// skill (a fixed, cacheable system prompt) and, in the latest message, the editor's current
// (unsaved) Data code, Draw ops and variables. It replies with a short explanation and only the
// code blocks it changed.

import { buildAiSkill } from "./skill";
import { formatWire, rowsToWire, wireToRows, type RawWireOp } from "@/lib/draw/wire";
import type { DrawRow } from "@/lib/draw/ops";

const FENCE = "```";

// The fixed instruction block, identical on every request so providers can cache it (Anthropic
// reads a cached copy at ~10% of the input price). Nothing per-user or per-request goes in here:
// the editor's state travels in the latest user message instead (withEditorState).
export function buildChatSystemPrompt(): string {
  return `${buildAiSkill()}

# You are inside the editor (this overrides "Output format" and "What to ask the user" above)

You are a chat assistant built into this Service's editor. The latest user message starts with the editor's current Data code, Draw ops and variables, followed by the user's request. Your code blocks are applied to the editor automatically (unsaved until the user presses Save & deploy), so:

- Reply with 1-3 short sentences saying what you changed or need, then **only the blocks that change**:
  - a ${FENCE}js block with the **complete** new Data code, if Data changes;
  - a ${FENCE}json block with the **complete** new Draw ops array, if Draw changes.
- Leave a section out entirely when it does not need to change. Never send a partial file.
- Always work from the editor state in the latest message; earlier messages may describe older code.
- If you need information first (an API, a field name, a secret name), ask briefly and send no blocks.
- Never ask for or include an API key; use \`secrets.NAME\` and tell the user which secret to create.
- No text after the last block.`;
}

// The latest user message: the editor's current (unsaved) state, then the request.
export function withEditorState(
  request: string,
  input: { code: string; rows: DrawRow[]; vars: Record<string, string | number | boolean> },
): string {
  const names = Object.keys(input.vars).sort();
  const varsText = names.length
    ? names.map((n) => `- {${n}} = ${JSON.stringify(input.vars[n])}`).join("\n")
    : "(none: the Data code exports nothing yet, or its last run failed)";

  return `## Current Data code

${FENCE}js
${input.code.trim() || "// (empty)"}
${FENCE}

## Current Draw ops

${FENCE}json
${input.rows.length ? formatWire(rowsToWire(input.rows)) : "[]"}
${FENCE}

## Variables from the last Data run

${varsText}

## Request

${request}`;
}

export interface ParsedReply {
  /** The reply with code blocks removed: what the chat shows. */
  text: string;
  dataCode?: string;
  /** Raw text of the json block, not yet validated. */
  drawText?: string;
}

// Takes the last js/javascript block and the last json block; any other fences are left in the text.
export function parseReply(reply: string): ParsedReply {
  let dataCode: string | undefined;
  let drawText: string | undefined;
  const text = reply
    // json first: with js first, "json" matches as "js" + "on".
    .replace(/```(json|javascript|js)[^\n]*\n([\s\S]*?)```/gi, (_, lang: string, body: string) => {
      if (lang.toLowerCase() === "json") drawText = body.trim();
      else dataCode = body.trim() + "\n";
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, dataCode, drawText };
}

// Validates Draw JSON from the model. Returns the wire ops (the client turns them into rows) or an
// error message to feed back to the model.
export function validateDraw(text: string): { ok: true; wire: RawWireOp[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const res = wireToRows(data);
  return res.ok ? { ok: true, wire: rowsToWire(res.rows) } : { ok: false, error: res.error };
}
