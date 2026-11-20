import { postJson, ProviderError, type CompletionRequest, type LlmProvider } from "./types";

// Google Gemini API (AI Studio key). Free tier available; see ai.google.dev for current limits.
export class GeminiProvider implements LlmProvider {
  readonly label: string;
  // Minimal thinking keeps replies fast (Gemini 3 thinks a lot by default, enough to time the route
  // out). Models that reject the setting get retried without it, and it stays off after that.
  private lowThinking = true;

  constructor(
    private apiKey: string,
    private model: string,
  ) {
    this.label = `gemini (${model})`;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const started = Date.now();
    try {
      return await this.generate(req, this.lowThinking);
    } catch (e) {
      const rejected = this.lowThinking && e instanceof ProviderError && e.status === 400 && /thinking/i.test(e.message);
      if (!rejected) throw e;
      this.lowThinking = false;
      return this.generate({ ...req, timeoutMs: Math.max(1_000, req.timeoutMs - (Date.now() - started)) }, false);
    }
  }

  private async generate({ system, messages, maxTokens, timeoutMs }: CompletionRequest, lowThinking: boolean): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const body = (await postJson(
      this.label,
      url,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(lowThinking ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
        },
      },
      timeoutMs,
    )) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    // Skip thought-summary parts if the API includes any; only the answer is wanted.
    return (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
  }
}
