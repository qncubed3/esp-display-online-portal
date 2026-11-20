import { postJson, type CompletionRequest, type LlmProvider } from "./types";

// Any OpenAI-style /chat/completions API: OpenAI, Groq, OpenRouter, DeepSeek, GitHub Models, a
// local Ollama... The base URL picks the service, e.g. https://api.groq.com/openai/v1.
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly label: string;

  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string,
  ) {
    this.label = `${new URL(baseUrl).hostname} (${model})`;
  }

  async complete({ system, messages, maxTokens, timeoutMs }: CompletionRequest): Promise<string> {
    const body = (await postJson(
      this.label,
      `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      { model: this.model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...messages] },
      timeoutMs,
    )) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? "";
  }
}
