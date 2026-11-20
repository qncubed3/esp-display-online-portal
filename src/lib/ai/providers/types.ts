// The seam between the chat route and whichever LLM API is configured. Each provider adapts
// one HTTP API to this interface; the route never knows which one it is talking to.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** How much the model thinks before answering. "off" is fastest; each provider maps it to its own setting. */
export type Effort = "off" | "low" | "medium" | "high";
export const EFFORTS: readonly Effort[] = ["off", "low", "medium", "high"];

export interface CompletionRequest {
  system: string;
  effort: Effort;
  messages: ChatMessage[];
  maxTokens: number;
  /** Abort the HTTP request after this long. */
  timeoutMs: number;
  /** Receives the reply as it's written (providers that can't stream send it all at once). */
  onText?(delta: string): void;
  /** Called before each attempt, with the model about to answer; text streamed so far is void. */
  onAttempt?(model: string): void;
}

export interface LlmProvider {
  /** Shown in errors and logs, e.g. "gemini (gemini-3.8-flash)". */
  readonly label: string;
  /** The model id, e.g. "claude-haiku-5-5". */
  readonly model: string;
  /** The model's reply as plain text. Throws on HTTP or API errors. */
  complete(req: CompletionRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly timedOut = false,
    /** The model declined the request (safety); another provider may still answer. */
    readonly refused = false,
  ) {
    super(message);
  }
}

async function send(label: string, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw networkError(label, e);
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } | string } | null;
    const detail = typeof json?.error === "string" ? json.error : json?.error?.message;
    throw new ProviderError(`${label}: HTTP ${res.status}${detail ? ` - ${detail}` : ""}`, res.status);
  }
  return res;
}

function networkError(label: string, e: unknown): ProviderError {
  const timedOut = e instanceof Error && e.name === "TimeoutError";
  return new ProviderError(`${label}: ${timedOut ? "timed out" : "request failed"}`, undefined, timedOut);
}

// POSTs JSON and reads a server-sent-events reply, calling onData with each `data:` payload parsed
// as JSON. The timeout covers the whole stream.
export async function postSse(
  label: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  onData: (data: unknown) => void,
): Promise<void> {
  const res = await send(label, url, headers, body, timeoutMs);
  if (!res.body) throw new ProviderError(`${label}: empty response`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          onData(JSON.parse(payload));
        } catch {
          // Not JSON (a keep-alive or comment); skip.
        }
      }
    }
  } catch (e) {
    throw networkError(label, e);
  }
}

// POSTs JSON and returns the parsed body, turning non-2xx responses into a ProviderError with
// the API's own message when it sends one.
export async function postJson(
  label: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const res = await send(label, url, headers, body, timeoutMs);
  try {
    return await res.json();
  } catch (e) {
    throw networkError(label, e);
  }
}
