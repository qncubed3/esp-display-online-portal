import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type CompletionRequest, type Effort, type LlmProvider } from "./types";

// Thinking and effort settings for an effort choice. "off" turns thinking off where the model
// allows it (Haiku 5.5, Opus 5: `disabled`; Sonnet 5.5: `between_tools`); models where thinking
// can't be turned off (e.g. Opus 5.5) run at low effort instead.
function thinkingParams(model: string, effort: Effort): Pick<Anthropic.MessageCreateParams, "thinking" | "output_config"> {
  if (effort !== "off") return { output_config: { effort } };
  if (/^claude-(haiku-5-5|opus-5)$/.test(model)) return { thinking: { type: "disabled" }, output_config: { effort: "low" } };
  if (model === "claude-sonnet-5-5") {
    return { thinking: { type: "between_tools" } as unknown as Anthropic.MessageCreateParams["thinking"], output_config: { effort: "low" } };
  }
  return { output_config: { effort: "low" } };
}

// Anthropic Messages API (Claude), via the official SDK, streamed.
// The system prompt (the fixed instruction block) is cached: repeat requests within 5 minutes read
// it at ~10% of the input price. The route keeps it byte-identical between requests.
export class AnthropicProvider implements LlmProvider {
  readonly label: string;
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.label = `anthropic (${model})`;
    // Retries and fallbacks are handled by ResilientProvider, across models and providers.
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
  }

  async complete({ system, effort, messages, maxTokens, timeoutMs, onText }: CompletionRequest): Promise<string> {
    let res: Anthropic.Message;
    try {
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: maxTokens,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages,
          ...thinkingParams(this.model, effort),
        },
        { timeout: timeoutMs },
      );
      if (onText) stream.on("text", (delta) => onText(delta));
      res = await stream.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError(`${this.label}: timed out`, undefined, true);
      if (e instanceof Anthropic.APIError) throw new ProviderError(`${this.label}: HTTP ${e.status ?? "?"} - ${e.message}`, e.status);
      throw new ProviderError(`${this.label}: request failed`);
    }

    const u = res.usage;
    console.info(
      `${this.label} usage (effort ${effort}): input ${u.input_tokens}, cache read ${u.cache_read_input_tokens ?? 0}, ` +
        `cache write ${u.cache_creation_input_tokens ?? 0}, output ${u.output_tokens}`,
    );

    if (res.stop_reason === "refusal") {
      throw new ProviderError(`${this.label}: the model declined this request`, undefined, false, true);
    }
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }
}
