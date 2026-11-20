import { postSse, ProviderError, type CompletionRequest, type Effort, type LlmProvider } from "./types";

// Gemini's thinking levels for each effort choice ("minimal" is the closest to off).
const THINKING_LEVEL: Record<Effort, string> = { off: "minimal", low: "low", medium: "medium", high: "high" };

type Chunk = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };

// Google Gemini API (AI Studio key), streamed. Free tier available; see ai.google.dev for limits.
export class GeminiProvider implements LlmProvider {
  readonly label: string;
  // Models that reject the thinking setting get retried without it, and it stays off after that.
  private setThinking = true;

  constructor(
    private apiKey: string,
    readonly model: string,
  ) {
    this.label = `gemini (${model})`;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const started = Date.now();
    try {
      return await this.generate(req, this.setThinking);
    } catch (e) {
      // Rejected before any text was streamed, so retrying is safe.
      const rejected = this.setThinking && e instanceof ProviderError && e.status === 400 && /thinking/i.test(e.message);
      if (!rejected) throw e;
      this.setThinking = false;
      return this.generate({ ...req, timeoutMs: Math.max(1_000, req.timeoutMs - (Date.now() - started)) }, false);
    }
  }

  private async generate({ system, effort, messages, maxTokens, timeoutMs, onText }: CompletionRequest, setThinking: boolean): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`;
    let text = "";
    await postSse(
      this.label,
      url,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(setThinking ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL[effort] } } : {}),
        },
      },
      timeoutMs,
      (data) => {
        // Skip thought-summary parts if the API includes any; only the answer is wanted.
        const delta = ((data as Chunk).candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("");
        if (!delta) return;
        text += delta;
        onText?.(delta);
      },
    );
    return text;
  }
}
