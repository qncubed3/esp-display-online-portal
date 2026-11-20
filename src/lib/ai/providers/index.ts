import "server-only";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAiCompatibleProvider } from "./openai";
import { ResilientProvider } from "./resilient";
import type { LlmProvider } from "./types";

export type { ChatMessage, LlmProvider } from "./types";
export { ProviderError } from "./types";
export { isBusyError } from "./resilient";

// Picks the providers from env vars. Swapping providers is a config change:
//   AI_PROVIDER       = gemini (default) | anthropic | openai
//   AI_API_KEY        = that provider's key
//   AI_MODEL          = optional; defaults below
//   AI_BASE_URL       = openai only: the API base, e.g. https://api.groq.com/openai/v1
// Fallback, tried when the main model is overloaded, rate limited, out of credit or refuses:
//   AI_FALLBACK_PROVIDER = optional; defaults to AI_PROVIDER
//   AI_FALLBACK_API_KEY  = the fallback provider's key; defaults to AI_API_KEY for the same provider
//   AI_FALLBACK_MODEL    = optional, comma-separated, tried in order; defaults to the fallback
//                          provider's default model when it's a different provider
//   AI_FALLBACK_BASE_URL = openai fallback only
const DEFAULT_MODELS = {
  gemini: "gemini-3.8-flash",
  anthropic: "claude-haiku-5-5",
  openai: "gpt-4o-mini",
} as const;
type Kind = keyof typeof DEFAULT_MODELS;

function parseKind(value: string | undefined, fallback: Kind): Kind {
  const kind = (value || fallback).toLowerCase();
  if (kind in DEFAULT_MODELS) return kind as Kind;
  throw new Error(`Unknown AI provider "${kind}" (expected gemini, anthropic or openai)`);
}

function makeProvider(kind: Kind, apiKey: string, model: string, baseUrl?: string): LlmProvider {
  switch (kind) {
    case "gemini":
      return new GeminiProvider(apiKey, model);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "openai":
      return new OpenAiCompatibleProvider(apiKey, model, baseUrl || "https://api.openai.com/v1");
  }
}

export function getLlmProvider(): LlmProvider | null {
  const env = process.env;
  const apiKey = env.AI_API_KEY;
  if (!apiKey) return null;
  const kind = parseKind(env.AI_PROVIDER, "gemini");
  const providers = [makeProvider(kind, apiKey, env.AI_MODEL || DEFAULT_MODELS[kind], env.AI_BASE_URL)];

  const fbKind = parseKind(env.AI_FALLBACK_PROVIDER, kind);
  const sameProvider = fbKind === kind;
  const fbKey = env.AI_FALLBACK_API_KEY || (sameProvider ? apiKey : "");
  const fbModels = (env.AI_FALLBACK_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!fbModels.length && !sameProvider) fbModels.push(DEFAULT_MODELS[fbKind]);
  if (fbModels.length && !fbKey) {
    console.warn(`AI fallback (${fbKind}) skipped: set AI_FALLBACK_API_KEY.`);
  } else {
    const fbBaseUrl = env.AI_FALLBACK_BASE_URL || (sameProvider ? env.AI_BASE_URL : undefined);
    for (const model of fbModels) providers.push(makeProvider(fbKind, fbKey, model, fbBaseUrl));
  }

  return new ResilientProvider(providers);
}
