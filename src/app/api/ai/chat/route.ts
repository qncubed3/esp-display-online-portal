// In-editor AI chat for a Service.
//   POST { serviceId, messages, code, rows, vars } -> { text, dataCode?, wire?, drawError? }
// `messages` is the chat so far (last one from the user); code/rows/vars are the editor's current,
// unsaved state. The reply's code blocks come back separately so the editor can apply them.
// Signed-in owners and members only (the service is read with the user's client, so RLS applies).

import { buildChatSystemPrompt, parseReply, validateDraw } from "@/lib/ai/chat";
import { getLlmProvider, ProviderError, type ChatMessage } from "@/lib/ai/providers";
import type { DrawRow } from "@/lib/draw/ops";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_CODE_CHARS = 30_000;
const MAX_TOKENS = 4_096;

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

export async function POST(request: Request) {
  let body: { serviceId?: unknown; messages?: unknown; code?: unknown; rows?: unknown; vars?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { serviceId, messages, code, rows, vars } = body;
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

  const system = buildChatSystemPrompt({
    code,
    rows: rows as DrawRow[],
    vars: vars && typeof vars === "object" ? (vars as Record<string, string | number | boolean>) : {},
  });
  const chat: ChatMessage[] = (messages as ChatMessage[])
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  try {
    let reply = parseReply(await provider.complete({ system, messages: chat, maxTokens: MAX_TOKENS }));
    let draw = reply.drawText !== undefined ? validateDraw(reply.drawText) : undefined;

    // One repair round when the Draw JSON doesn't validate: show the model its error.
    if (draw && !draw.ok) {
      const retry = parseReply(
        await provider.complete({
          system,
          messages: [
            ...chat,
            { role: "assistant", content: `${reply.text}\n\n\`\`\`json\n${reply.drawText}\n\`\`\`` },
            { role: "user", content: `That Draw JSON is invalid: ${draw.error}\nSend the corrected complete json block only.` },
          ],
          maxTokens: MAX_TOKENS,
        }),
      );
      if (retry.drawText !== undefined) {
        const fixed = validateDraw(retry.drawText);
        if (fixed.ok) draw = fixed;
      }
    }

    if (!reply.text && reply.dataCode === undefined && !draw) reply = { ...reply, text: "(The model sent an empty reply. Try rephrasing.)" };
    return Response.json(
      {
        text: reply.text,
        dataCode: reply.dataCode,
        wire: draw?.ok ? draw.wire : undefined,
        drawError: draw && !draw.ok ? draw.error : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status = e instanceof ProviderError && e.status === 429 ? 429 : 502;
    const message = e instanceof Error ? e.message : "The AI request failed.";
    return Response.json({ error: status === 429 ? `The AI provider is rate limiting requests. ${message}` : message }, { status });
  }
}
