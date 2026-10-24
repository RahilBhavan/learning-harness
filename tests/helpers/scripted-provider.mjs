import { readFile } from "node:fs/promises";

// Scripted stand-in for a model. It returns fixed, schema-shaped artifacts built from the
// bundled reference lesson. It makes no network calls and is not exposed through the CLI.
const referenceLesson = JSON.parse(await readFile(new URL("../../content/harness-control-loop.json", import.meta.url), "utf8"));

export class TestProvider {
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
