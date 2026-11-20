import { postJson, type CompletionRequest, type LlmProvider } from "./types";

// Anthropic Messages API (Claude).
export class AnthropicProvider implements LlmProvider {
  readonly label: string;

  constructor(
    private apiKey: string,
    private model: string,
  ) {
    this.label = `anthropic (${model})`;
  }

  async complete({ system, messages, maxTokens }: CompletionRequest): Promise<string> {
    const body = (await postJson(
      this.label,
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      { model: this.model, max_tokens: maxTokens, system, messages },
    )) as { content?: { type: string; text?: string }[] };
    return (body.content ?? []).map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");
  }
}
