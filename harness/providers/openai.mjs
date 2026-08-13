import { toOpenAICompatibleSchema } from "../contracts.mjs";

function responseText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "refusal") throw new Error(`Model refused the stage: ${part.refusal}`);
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  throw new Error("OpenAI response did not contain output text.");
}

function schemaName(stage) {
  return `learning_harness_${stage.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`.slice(0, 64);
}

export class OpenAIProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL, baseUrl = "https://api.openai.com/v1", fetchImpl = fetch } = {}) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the OpenAI provider.");
    if (!model) throw new Error("OPENAI_MODEL is required; the harness does not silently choose a model.");
    this.apiKey = apiKey;
    this.id = "openai";
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async generate({ stage, schema, system, input }) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
          method: "POST",
          headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            instructions: system,
            input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] }],
            text: { format: { type: "json_schema", name: schemaName(stage), strict: true, schema: toOpenAICompatibleSchema(schema) } },
          }),
          signal: AbortSignal.timeout(120_000),
        });
        const payload = await response.json();
        if (!response.ok) {
          const error = new Error(`OpenAI request failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
          error.retryable = response.status === 429 || response.status >= 500;
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
