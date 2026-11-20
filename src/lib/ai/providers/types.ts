// The seam between the chat route and whichever LLM API is configured. Each provider adapts
// one HTTP API to this interface; the route never knows which one it is talking to.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  /** Abort the HTTP request after this long. */
  timeoutMs: number;
}

export interface LlmProvider {
  /** Shown in errors and logs, e.g. "gemini (gemini-3.8-flash)". */
  readonly label: string;
  /** The model's reply as plain text. Throws on HTTP or API errors. */
  complete(req: CompletionRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly timedOut = false,
  ) {
    super(message);
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
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    throw new ProviderError(`${label}: ${timedOut ? "timed out" : "request failed"}`, undefined, timedOut);
  }
  const json = (await res.json().catch(() => null)) as { error?: { message?: string } | string } | null;
  if (!res.ok) {
    const detail = typeof json?.error === "string" ? json.error : json?.error?.message;
    throw new ProviderError(`${label}: HTTP ${res.status}${detail ? ` - ${detail}` : ""}`, res.status);
  }
  return json;
}
