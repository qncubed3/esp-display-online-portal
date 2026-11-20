import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type CompletionRequest, type LlmProvider } from "./types";

// Anthropic Messages API (Claude), via the official SDK.
// - The system prompt (the fixed instruction block) is cached: repeat requests within 5 minutes
//   read it at ~10% of the input price. The route keeps it byte-identical between requests.
// - Low effort keeps replies fast and cheap; thinking tokens are billed as output.
export class AnthropicProvider implements LlmProvider {
  readonly label: string;
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.label = `anthropic (${model})`;
    // Retries and fallbacks are handled by ResilientProvider, across models and providers.
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async complete({ system, messages, maxTokens, timeoutMs }: CompletionRequest): Promise<string> {
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: maxTokens,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages,
          output_config: { effort: "low" },
        },
        { timeout: timeoutMs },
      );
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError(`${this.label}: timed out`, undefined, true);
      if (e instanceof Anthropic.APIError) throw new ProviderError(`${this.label}: HTTP ${e.status ?? "?"} - ${e.message}`, e.status);
      throw new ProviderError(`${this.label}: request failed`);
    }

    const u = res.usage;
    console.info(
      `${this.label} usage: input ${u.input_tokens}, cache read ${u.cache_read_input_tokens ?? 0}, ` +
        `cache write ${u.cache_creation_input_tokens ?? 0}, output ${u.output_tokens}`,
    );

    if (res.stop_reason === "refusal") {
      throw new ProviderError(`${this.label}: the model declined this request`, undefined, false, true);
    }
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }
}
