import "server-only";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAiCompatibleProvider } from "./openai";
import { ResilientProvider } from "./resilient";
import type { LlmProvider } from "./types";

export type { ChatMessage, LlmProvider } from "./types";
export { ProviderError } from "./types";
export { isBusyError } from "./resilient";

// Picks the provider from env vars. Swapping providers is a config change:
//   AI_PROVIDER = gemini (default) | anthropic | openai
//   AI_API_KEY  = that provider's key
//   AI_MODEL    = optional; defaults below
//   AI_BASE_URL = openai only: the API base, e.g. https://api.groq.com/openai/v1
//   AI_FALLBACK_MODEL = optional, comma-separated: same provider and key, tried in order when the
//                       main model is overloaded or rate limited
const DEFAULT_MODELS = {
  gemini: "gemini-3.8-flash",
  anthropic: "claude-haiku-5-5",
  openai: "gpt-4o-mini",
} as const;

export function getLlmProvider(): LlmProvider | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const kind = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const fallbacks = (process.env.AI_FALLBACK_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  let make: (model: string) => LlmProvider;
  let defaultModel: string;
  switch (kind) {
    case "gemini":
      make = (m) => new GeminiProvider(apiKey, m);
      defaultModel = DEFAULT_MODELS.gemini;
      break;
    case "anthropic":
      make = (m) => new AnthropicProvider(apiKey, m);
      defaultModel = DEFAULT_MODELS.anthropic;
      break;
    case "openai": {
      const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
      make = (m) => new OpenAiCompatibleProvider(apiKey, m, baseUrl);
      defaultModel = DEFAULT_MODELS.openai;
      break;
    }
    default:
      throw new Error(`Unknown AI_PROVIDER "${kind}" (expected gemini, anthropic or openai)`);
  }
  const models = [process.env.AI_MODEL || defaultModel, ...fallbacks];
  return new ResilientProvider([...new Set(models)].map(make));
}
