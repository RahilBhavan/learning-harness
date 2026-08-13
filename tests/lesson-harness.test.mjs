import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { artifactNames, loadLessonGenerationSchema, stageSchemas } from "../harness/contracts.mjs";
import { runLessonPipeline } from "../harness/pipeline.mjs";
import { AnthropicProvider } from "../harness/providers/anthropic.mjs";
import { OpenAIProvider } from "../harness/providers/openai.mjs";
import { approveRun, inspectRun, installRun } from "../harness/run-store.mjs";
import { validateBrief } from "../harness/validate.mjs";

const exampleBrief = JSON.parse(await readFile(new URL("../examples/lesson-brief.json", import.meta.url), "utf8"));
const referenceLesson = JSON.parse(await readFile(new URL("../content/harness-control-loop.json", import.meta.url), "utf8"));
const fixedClock = () => new Date("2026-08-13T12:00:00.000Z");

class TestProvider {
  constructor() { this.id = "test"; this.model = "contract-test"; }
  async generate({ stage, input }) {
    if (stage === "claims") return {
      topic: input.brief.topic,
      claims: [
        { id: "claim-1", text: "Reliable agent work uses observable feedback.", status: "supported", sourceIds: [input.sourcePack.sources[0].id], rationale: "Directly supported by the first source." },
        { id: "claim-2", text: "Durable state supports recovery across sessions.", status: "supported", sourceIds: [input.sourcePack.sources[1].id], rationale: "Directly supported by the second source." },
      ],
      gaps: [],
    };
    if (stage === "plan") return {
      mentalModel: "A reliable harness closes the loop between intent, action, observation, and correction.",
      learnerJourney: "Inspect, manipulate, retrieve, and transfer the model.",
      misconceptions: [{ belief: "A prompt is enough.", correction: "Execution and feedback close the loop.", diagnosticQuestion: "What makes a result observable?" }],
      sections: referenceLesson.sections.map((section, index) => ({ id: section.id, title: section.title, objective: referenceLesson.objectives[index % referenceLesson.objectives.length], claimIds: [index % 2 ? "claim-2" : "claim-1"], blockTypes: section.blocks.map((block) => block.type) })),
      assessmentPlan: referenceLesson.objectives.map((objective) => ({ objective, evidence: "A scored response or completed transfer exercise.", timing: "during" })),
    };
    if (stage === "interactions") return {
      interactions: [
        { id: "map", type: "system-map", title: "Control loop", learningPurpose: "Expose the mechanism.", variables: [], expectedObservation: "Feedback changes the next action.", evidenceClaimIds: ["claim-1"] },
        { id: "sim", type: "simulator", title: "Tune the loop", learningPurpose: "Manipulate causal inputs.", variables: [{ name: "feedback", relationship: "More direct feedback improves correction." }, { name: "delay", relationship: "Longer delay increases drift." }], expectedObservation: "Loop health changes with the inputs.", evidenceClaimIds: ["claim-1", "claim-2"] },
      ],
    };
    if (stage === "lesson" || stage.startsWith("repair")) return { ...structuredClone(referenceLesson), sources: input.sourcePack.sources.map(({ label, url }) => ({ label, url })) };
    if (stage === "evaluation") return { verdict: "pass", scores: { factualGrounding: 5, objectiveAlignment: 5, interactionIntegrity: 5, misconceptionQuality: 4, transferQuality: 5 }, issues: [], summary: "All contract gates pass." };
    throw new Error(`Unexpected test stage: ${stage}`);
  }
}

test("example brief satisfies the source and objective contract", () => {
  assert.deepEqual(validateBrief(exampleBrief), []);
});

test("pipeline produces a resumable, publishable lesson run", async () => {
  const runDir = await mkdtemp(path.join(tmpdir(), "learning-harness-run-"));
  const first = await runLessonPipeline({ brief: exampleBrief, runDir, provider: new TestProvider(), clock: fixedClock });
  assert.equal(first.manifest.status, "awaiting-human-review");
  assert.equal(first.evaluation.publishable, true);
  assert.equal(first.evaluation.deterministic.errors.length, 0);
  assert.match(await readFile(path.join(runDir, artifactNames.review), "utf8"), /Human review:/);
  const files = await readdir(runDir);
  for (const filename of Object.values(artifactNames).filter((name) => name !== artifactNames.approval)) assert.ok(files.includes(filename), `missing ${filename}`);

  const second = await runLessonPipeline({ brief: exampleBrief, runDir, provider: new TestProvider(), clock: fixedClock });
  assert.equal(second.manifest.stages.claims.status, "reused");
  assert.equal(second.manifest.stages.lesson.status, "reused");
  assert.equal(second.manifest.stages.evaluation.status, "reused");

  await assert.rejects(
    runLessonPipeline({ brief: { ...exampleBrief, topic: "A changed topic" }, runDir, provider: new TestProvider(), clock: fixedClock }),
    /brief changed/i,
  );
});

test("failed deterministic gates trigger one bounded repair", async () => {
  class RepairingProvider extends TestProvider {
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

test("approval is bound to the exact evaluated lesson and protects installation", async () => {
  const runDir = await mkdtemp(path.join(tmpdir(), "learning-harness-approval-"));
  await runLessonPipeline({ brief: exampleBrief, runDir, provider: new TestProvider(), clock: fixedClock });
  await approveRun({ runDir, reviewer: "Ada Reviewer", clock: fixedClock });
  assert.equal((await inspectRun(runDir)).approvalValid, true);

  const targetDir = await mkdtemp(path.join(tmpdir(), "learning-harness-install-"));
  const target = path.join(targetDir, "lesson.json");
  await installRun({ runDir, target });
  await assert.rejects(installRun({ runDir, target }), /exist/i);

  const lessonFile = path.join(runDir, artifactNames.lesson);
  const lesson = JSON.parse(await readFile(lessonFile, "utf8"));
  lesson.title = "Changed after approval";
  await writeFile(lessonFile, `${JSON.stringify(lesson)}\n`);
  assert.equal((await inspectRun(runDir)).approvalValid, false);
  await assert.rejects(installRun({ runDir, target: path.join(targetDir, "tampered.json") }), /valid approval/i);
  await assert.rejects(approveRun({ runDir, reviewer: "Ada Reviewer", clock: fixedClock }), /changed after evaluation/i);
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

test("Anthropic provider sends a Messages API structured output request", async () => {
  let captured;
  const provider = new AnthropicProvider({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ content: [{ type: "text", text: '{"topic":"x","claims":[],"gaps":[]}' }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const output = await provider.generate({ stage: "claims", schema: stageSchemas.claims, system: "system", input: { topic: "x" } });
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.body.model, "test-model");
  assert.equal(captured.body.output_config.format.type, "json_schema");
  assert.equal(captured.body.output_config.format.schema.properties.claims.items.additionalProperties, false);
  assert.equal(captured.options.headers["x-api-key"], "test-key");
  assert.equal(captured.options.headers["anthropic-version"], "2023-06-01");
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
