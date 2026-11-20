import { postJson, type CompletionRequest, type LlmProvider } from "./types";

// Any OpenAI-style /chat/completions API: OpenAI, Groq, OpenRouter, DeepSeek, GitHub Models, a
// local Ollama... The base URL picks the service, e.g. https://api.groq.com/openai/v1.
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly label: string;

  constructor(
    private apiKey: string,
    readonly model: string,
    private baseUrl: string,
  ) {
    this.label = `${new URL(baseUrl).hostname} (${model})`;
  }

  async complete({ system, messages, maxTokens, timeoutMs, onText }: CompletionRequest): Promise<string> {
    const body = (await postJson(
      this.label,
      `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      { model: this.model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...messages] },
      timeoutMs,
    )) as { choices?: { message?: { content?: string } }[] };
    // Not streamed: the whole reply arrives at once. Effort isn't mapped (no common setting).
    const text = body.choices?.[0]?.message?.content ?? "";
    onText?.(text);
    return text;
  }
}
