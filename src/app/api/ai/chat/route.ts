// In-editor AI chat for a Service.
//   GET -> { model } (the configured model, or null when AI isn't set up)
//   POST { serviceId, messages, code, rows, vars, effort } -> newline-delimited JSON events:
//     { type: "attempt", model }   a model starts answering; drop any text streamed so far
//     { type: "text", delta }      reply text as it's written
//     { type: "status", text }     e.g. while the Draw JSON is being repaired
//     { type: "done", text, dataCode?, wire?, drawError?, model }
//     { type: "error", error }
//   Errors before the model is called (bad input, auth, rate limit) are plain JSON with a status.
// `messages` is the chat so far (last one from the user); code/rows/vars are the editor's current,
// unsaved state. The reply's code blocks come back separately so the editor can apply them.
// Signed-in owners and members only (the service is read with the user's client, so RLS applies).

import { buildChatSystemPrompt, parseReply, validateDraw, withEditorState } from "@/lib/ai/chat";
import { EFFORTS, getLlmProvider, isBusyError, ProviderError, type ChatMessage, type Effort } from "@/lib/ai/providers";
import type { DrawRow } from "@/lib/draw/ops";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// The model calls share a budget that ends before the platform's limit, so a slow model gives a
// clear "took too long" error instead of the platform killing the function (a bare 504).
export const maxDuration = 120;
const BUDGET_MS = 110_000;
// Only attempt the Draw JSON repair round with at least this much budget left.
const MIN_REPAIR_MS = 25_000;

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_CODE_CHARS = 30_000;
// Room for thinking (low effort) plus full Data code and Draw JSON.
const MAX_TOKENS = 16_000;

// Per-user rate limit. In memory, so per server instance: a guard against runaway use of the
// provider quota, not a hard limit.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
const recent = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) return true;
  times.push(now);
  recent.set(userId, times);
  return false;
}

function isMessage(m: unknown): m is ChatMessage {
  const o = m as ChatMessage;
  return !!o && (o.role === "user" || o.role === "assistant") && typeof o.content === "string";
}

function errorMessage(e: unknown): string {
  if (e instanceof ProviderError && e.timedOut) return "The AI took too long to reply. Try again, or ask for a smaller change.";
  if (isBusyError(e)) return "The AI model is busy right now (the provider is overloaded). Try again in a minute.";
  const message = e instanceof Error ? e.message : "The AI request failed.";
  return e instanceof ProviderError && e.status === 429 ? `The AI provider is rate limiting requests. ${message}` : message;
}

export async function GET() {
  const provider = getLlmProvider();
  return Response.json({ model: provider?.model ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: { serviceId?: unknown; messages?: unknown; code?: unknown; rows?: unknown; vars?: unknown; effort?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { serviceId, messages, code, rows, vars } = body;
  const effort: Effort = EFFORTS.includes(body.effort as Effort) ? (body.effort as Effort) : "off";
  if (typeof serviceId !== "string" || !serviceId) return Response.json({ error: "serviceId is required" }, { status: 400 });
  if (!Array.isArray(messages) || !messages.length || !messages.every(isMessage) || messages.at(-1)!.role !== "user") {
    return Response.json({ error: "messages must be a non-empty chat ending with a user message" }, { status: 400 });
  }
  if (typeof code !== "string" || code.length > MAX_CODE_CHARS || !Array.isArray(rows)) {
    return Response.json({ error: "code and rows are required" }, { status: 400 });
  }

  const provider = getLlmProvider();
  if (!provider) {
    return Response.json({ error: "AI chat is not set up: add AI_API_KEY (and optionally AI_PROVIDER) to the server env." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data: service, error } = await supabase.from("services").select("id").eq("id", serviceId).maybeSingle();
  if (error && error.code !== "22P02") return Response.json({ error: error.message }, { status: 500 });
  if (!service) return Response.json({ error: "Service not found" }, { status: 404 });

  if (rateLimited(user.id)) {
    return Response.json({ error: "Too many messages. Wait a few minutes and try again." }, { status: 429 });
  }

  // Fixed instructions (cacheable) as the system prompt; the editor's state rides on the latest message.
  const system = buildChatSystemPrompt();
  const chat: ChatMessage[] = (messages as ChatMessage[])
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  const latest = chat[chat.length - 1];
  latest.content = withEditorState(latest.content, {
    code,
    rows: rows as DrawRow[],
    vars: vars && typeof vars === "object" ? (vars as Record<string, string | number | boolean>) : {},
  });

  const deadline = Date.now() + BUDGET_MS;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      let answeredBy = provider.model;
      try {
        let reply = parseReply(
          await provider.complete({
            system,
            effort,
            messages: chat,
            maxTokens: MAX_TOKENS,
            timeoutMs: BUDGET_MS,
            onAttempt: (model) => {
              answeredBy = model;
              send({ type: "attempt", model });
            },
            onText: (delta) => send({ type: "text", delta }),
          }),
        );
        let draw = reply.drawText !== undefined ? validateDraw(reply.drawText) : undefined;

        // One repair round when the Draw JSON doesn't validate: show the model its error. Not streamed.
        if (draw && !draw.ok && deadline - Date.now() > MIN_REPAIR_MS) {
          send({ type: "status", text: "Fixing the Draw JSON…" });
          const retry = parseReply(
            await provider.complete({
              system,
              effort,
              messages: [
                ...chat,
                { role: "assistant", content: `${reply.text}\n\n\`\`\`json\n${reply.drawText}\n\`\`\`` },
                { role: "user", content: `That Draw JSON is invalid: ${draw.error}\nSend the corrected complete json block only.` },
              ],
              maxTokens: MAX_TOKENS,
              timeoutMs: deadline - Date.now(),
            }),
          );
          if (retry.drawText !== undefined) {
            const fixed = validateDraw(retry.drawText);
            if (fixed.ok) draw = fixed;
          }
        }

        if (!reply.text && reply.dataCode === undefined && !draw) reply = { ...reply, text: "(The model sent an empty reply. Try rephrasing.)" };
        send({
          type: "done",
          text: reply.text,
          dataCode: reply.dataCode,
          wire: draw?.ok ? draw.wire : undefined,
          drawError: draw && !draw.ok ? draw.error : undefined,
          model: answeredBy,
        });
      } catch (e) {
        send({ type: "error", error: errorMessage(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
