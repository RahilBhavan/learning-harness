import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { artifactNames, loadLessonGenerationSchema, stageSchemas } from "../harness/contracts.mjs";
import { runLessonPipeline } from "../harness/pipeline.mjs";
import { FixtureProvider } from "../harness/providers/fixture.mjs";
import { OpenAIProvider } from "../harness/providers/openai.mjs";
import { validateBrief } from "../harness/validate.mjs";

const exampleBrief = JSON.parse(await readFile(new URL("../examples/lesson-brief.json", import.meta.url), "utf8"));
const fixedClock = () => new Date("2026-08-13T12:00:00.000Z");

test("example brief satisfies the source and objective contract", () => {
  assert.deepEqual(validateBrief(exampleBrief), []);
});

test("fixture provider produces a resumable, publishable lesson run", async () => {
  const runDir = await mkdtemp(path.join(tmpdir(), "learning-harness-run-"));
  const first = await runLessonPipeline({ brief: exampleBrief, runDir, provider: new FixtureProvider(), clock: fixedClock });
  assert.equal(first.manifest.status, "awaiting-human-review");
  assert.equal(first.evaluation.publishable, true);
  assert.equal(first.evaluation.deterministic.errors.length, 0);
  assert.match(await readFile(path.join(runDir, artifactNames.review), "utf8"), /Human review:/);
  const files = await readdir(runDir);
  for (const filename of Object.values(artifactNames)) assert.ok(files.includes(filename), `missing ${filename}`);

  const second = await runLessonPipeline({ brief: exampleBrief, runDir, provider: new FixtureProvider(), clock: fixedClock });
  assert.equal(second.manifest.stages.claims.status, "reused");
  assert.equal(second.manifest.stages.lesson.status, "reused");
  assert.equal(second.manifest.stages.evaluation.status, "reused");

  await assert.rejects(
    runLessonPipeline({ brief: { ...exampleBrief, topic: "A changed topic" }, runDir, provider: new FixtureProvider(), clock: fixedClock }),
    /brief changed/i,
  );
});

test("failed deterministic gates trigger one bounded repair", async () => {
  class RepairingProvider extends FixtureProvider {
    constructor() { super(); this.lessonCalls = 0; }
    async generate(request) {
      const value = await super.generate(request);
      if (request.stage === "lesson" && this.lessonCalls++ === 0) value.sources.push({ label: "Invented source", url: "https://invalid.example/source" });
      return value;
    }
  }
  const runDir = await mkdtemp(path.join(tmpdir(), "learning-harness-repair-"));
  const result = await runLessonPipeline({ brief: exampleBrief, runDir, provider: new RepairingProvider(), clock: fixedClock, maxRepairs: 1 });
  assert.equal(result.evaluation.publishable, true);
  assert.equal(result.evaluation.repairAttempts, 1);
});

test("OpenAI provider sends an official Responses API JSON Schema request", async () => {
  let captured;
  const provider = new OpenAIProvider({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: '{"topic":"x","claims":[],"gaps":[]}' }] }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const output = await provider.generate({ stage: "claims", schema: stageSchemas.claims, system: "system", input: { topic: "x" } });
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.body.model, "test-model");
  assert.equal(captured.body.text.format.type, "json_schema");
  assert.equal(captured.body.text.format.strict, true);
  assert.equal(captured.body.text.format.schema.properties.claims.items.additionalProperties, false);
  assert.equal(captured.options.headers.authorization, "Bearer test-key");
  assert.equal(output.topic, "x");
});

test("lesson generation schema is strict for structured outputs", async () => {
  const schema = await loadLessonGenerationSchema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$schema, undefined);
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
  assert.ok(schema.$defs.block.anyOf);
  assert.equal(schema.$defs.block.oneOf, undefined);
  assert.ok(schema.$defs.simulator.properties.controls.items.required.includes("inverse"));
});
