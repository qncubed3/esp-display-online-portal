import { postJson, type CompletionRequest, type LlmProvider } from "./types";

// Google Gemini API (AI Studio key). Free tier available; see ai.google.dev for current limits.
export class GeminiProvider implements LlmProvider {
  readonly label: string;

  constructor(
    private apiKey: string,
    private model: string,
  ) {
    this.label = `gemini (${model})`;
  }

  async complete({ system, messages, maxTokens }: CompletionRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const body = (await postJson(
      this.label,
      url,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens },
      },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  }
}
