import "server-only";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAiCompatibleProvider } from "./openai";
import type { LlmProvider } from "./types";

export type { ChatMessage, LlmProvider } from "./types";
export { ProviderError } from "./types";

// Picks the provider from env vars. Swapping providers is a config change:
//   AI_PROVIDER = gemini (default) | anthropic | openai
//   AI_API_KEY  = that provider's key
//   AI_MODEL    = optional; defaults below
//   AI_BASE_URL = openai only: the API base, e.g. https://api.groq.com/openai/v1
const DEFAULT_MODELS = {
  gemini: "gemini-3.8-flash",
  anthropic: "claude-haiku-5-5",
  openai: "gpt-4o-mini",
} as const;

export function getLlmProvider(): LlmProvider | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const kind = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const model = process.env.AI_MODEL || undefined;

  switch (kind) {
    case "gemini":
      return new GeminiProvider(apiKey, model ?? DEFAULT_MODELS.gemini);
    case "anthropic":
      return new AnthropicProvider(apiKey, model ?? DEFAULT_MODELS.anthropic);
    case "openai":
      return new OpenAiCompatibleProvider(apiKey, model ?? DEFAULT_MODELS.openai, process.env.AI_BASE_URL || "https://api.openai.com/v1");
    default:
      throw new Error(`Unknown AI_PROVIDER "${kind}" (expected gemini, anthropic or openai)`);
  }
}
