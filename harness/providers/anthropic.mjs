import { toOpenAICompatibleSchema } from "../contracts.mjs";

function responseText(payload) {
  const text = payload.content
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
  if (text) return text;
  throw new Error("Anthropic response did not contain output text.");
}

export class AnthropicProvider {
  constructor({
    apiKey = process.env.ANTHROPIC_API_KEY,
    model = process.env.ANTHROPIC_MODEL,
    baseUrl = "https://api.anthropic.com/v1",
    fetchImpl = fetch,
    maxTokens = 16_000,
  } = {}) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for the Anthropic provider.");
    if (!model) throw new Error("ANTHROPIC_MODEL is required; the harness does not silently choose a model.");
    this.apiKey = apiKey;
    this.id = "anthropic";
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.maxTokens = maxTokens;
  }

  async generate({ schema, system, input }) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/messages`, {
          method: "POST",
          headers: {
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "x-api-key": this.apiKey,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.maxTokens,
            system,
            messages: [{ role: "user", content: JSON.stringify(input) }],
            output_config: {
              format: {
                type: "json_schema",
                schema: toOpenAICompatibleSchema(schema),
              },
            },
          }),
          signal: AbortSignal.timeout(120_000),
        });
        const payload = await response.json();
        if (!response.ok) {
          const error = new Error(`Anthropic request failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
          error.retryable = response.status === 429 || response.status === 529 || response.status >= 500;
          throw error;
        }
        return JSON.parse(responseText(payload));
      } catch (error) {
        lastError = error;
        const retryable = error.retryable || error.name === "TypeError" || error.name === "TimeoutError";
        if (!retryable || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw lastError;
  }
}
