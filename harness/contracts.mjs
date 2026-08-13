import { readFile } from "node:fs/promises";

const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const stringArray = { type: "array", items: { type: "string" } };

export const stageSchemas = {
  claims: object({
    topic: { type: "string" },
    claims: {
      type: "array",
      items: object({
        id: { type: "string" },
        text: { type: "string" },
        status: { type: "string", enum: ["supported", "inferred", "illustrative", "disputed", "missing"] },
        sourceIds: stringArray,
        rationale: { type: "string" },
      }),
    },
    gaps: stringArray,
  }),
  plan: object({
    mentalModel: { type: "string" },
    learnerJourney: { type: "string" },
    misconceptions: {
      type: "array",
      items: object({
        belief: { type: "string" },
        correction: { type: "string" },
        diagnosticQuestion: { type: "string" },
      }),
    },
    sections: {
      type: "array",
      items: object({
        id: { type: "string" },
        title: { type: "string" },
        objective: { type: "string" },
        claimIds: stringArray,
        blockTypes: { type: "array", items: { type: "string", enum: ["prose", "system-map", "comparison", "simulator", "evidence", "quiz", "takeaway", "exercise"] } },
      }),
    },
    assessmentPlan: {
      type: "array",
      items: object({
        objective: { type: "string" },
        evidence: { type: "string" },
        timing: { type: "string", enum: ["before", "during", "after"] },
      }),
    },
  }),
  interactions: object({
    interactions: {
      type: "array",
      items: object({
        id: { type: "string" },
        type: { type: "string", enum: ["system-map", "comparison", "simulator", "evidence", "quiz", "exercise"] },
        title: { type: "string" },
        learningPurpose: { type: "string" },
        variables: {
          type: "array",
          items: object({
            name: { type: "string" },
            relationship: { type: "string" },
          }),
        },
        expectedObservation: { type: "string" },
        evidenceClaimIds: stringArray,
      }),
    },
  }),
  evaluation: object({
    verdict: { type: "string", enum: ["pass", "revise"] },
    scores: object({
      factualGrounding: { type: "integer", minimum: 1, maximum: 5 },
      objectiveAlignment: { type: "integer", minimum: 1, maximum: 5 },
      interactionIntegrity: { type: "integer", minimum: 1, maximum: 5 },
      misconceptionQuality: { type: "integer", minimum: 1, maximum: 5 },
      transferQuality: { type: "integer", minimum: 1, maximum: 5 },
    }),
    issues: {
      type: "array",
      items: object({
        code: { type: "string" },
        severity: { type: "string", enum: ["error", "warning"] },
        stage: { type: "string" },
        message: { type: "string" },
      }),
    },
    summary: { type: "string" },
  }),
};

function makeStrictSchema(value) {
  if (Array.isArray(value)) return value.map(makeStrictSchema);
  if (!value || typeof value !== "object") return value;
  const unsupported = new Set(["$schema", "$id", "format", "minLength", "maxLength", "pattern", "minimum", "maximum", "minItems", "maxItems"]);
  const next = Object.fromEntries(Object.entries(value)
    .filter(([key]) => !unsupported.has(key) && key !== "const")
    .map(([key, child]) => [key === "oneOf" ? "anyOf" : key, makeStrictSchema(child)]));
  if (Object.hasOwn(value, "const")) next.enum = [value.const];
  if (next.type === "object" && next.properties) next.required = Object.keys(next.properties);
  return next;
}

export const toOpenAICompatibleSchema = makeStrictSchema;

export async function loadLessonGenerationSchema() {
  const raw = JSON.parse(await readFile(new URL("../content/lesson.schema.json", import.meta.url), "utf8"));
  return makeStrictSchema(raw);
}

export const artifactNames = {
  brief: "00-brief.json",
  sources: "01-source-pack.json",
  claims: "02-claim-ledger.json",
  plan: "03-learning-plan.json",
  interactions: "04-interaction-specs.json",
  lesson: "05-lesson.json",
  evaluation: "06-evaluation-report.json",
  review: "07-human-review.md",
  manifest: "run.json",
};
