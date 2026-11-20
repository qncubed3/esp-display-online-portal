import { ProviderError, type CompletionRequest, type LlmProvider } from "./types";

// Busy = the provider is overloaded or erroring on its side; worth a retry or another model.
const BUSY = new Set([500, 502, 503, 504, 529]);
const RETRY_DELAY_MS = 1_500;
// Don't start an attempt with less time than this left in the request's budget.
const MIN_ATTEMPT_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wraps the configured model plus optional fallbacks. Each model gets one quick retry when the
// provider is busy (e.g. Gemini's "high demand" 503); a rate limit (429) skips straight to the next
// model, since free-tier quotas are per model. Other errors are thrown as they are.
export class ResilientProvider implements LlmProvider {
  readonly label: string;

  constructor(private providers: LlmProvider[]) {
    this.label = providers[0].label;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const started = Date.now();
    let last: unknown;
    for (const provider of this.providers) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const remaining = req.timeoutMs - (Date.now() - started);
        if (remaining < MIN_ATTEMPT_MS) throw last ?? new ProviderError(`${provider.label}: timed out`, undefined, true);
        try {
          return await provider.complete({ ...req, timeoutMs: remaining });
        } catch (e) {
          const status = e instanceof ProviderError ? e.status : undefined;
          if (status === undefined || (!BUSY.has(status) && status !== 429)) throw e;
          last = e;
          console.warn(`${e instanceof Error ? e.message : e} (attempt ${attempt + 1})`);
          if (status === 429) break;
          if (attempt === 0) await sleep(RETRY_DELAY_MS);
        }
      }
    }
    throw last;
  }
}

export const isBusyError = (e: unknown) => e instanceof ProviderError && e.status !== undefined && BUSY.has(e.status);
