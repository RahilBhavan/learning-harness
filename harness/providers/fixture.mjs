function fixtureClaims(input) {
  const sources = input.sourcePack.sources;
  return {
    topic: input.brief.topic,
    claims: [
      { id: "claim-1", text: `${input.brief.topic} can be understood as a sequence of observable causes and effects.`, status: "supported", sourceIds: [sources[0].id], rationale: `Grounded in ${sources[0].label}.` },
      { id: "claim-2", text: "Feedback changes the next action only when the result is observable.", status: "supported", sourceIds: [sources[1].id], rationale: `Grounded in ${sources[1].label}.` },
      { id: "claim-3", text: "The simulator values are an illustrative teaching model rather than benchmark measurements.", status: "illustrative", sourceIds: [], rationale: "Used only to expose a qualitative relationship." },
    ],
    gaps: [],
  };
}

function fixturePlan(input) {
  return {
    mentalModel: `${input.brief.topic} is a closed loop: a goal drives an action, observation reveals the gap, and feedback changes the next action.`,
    learnerJourney: "Begin with the failure of an open loop, inspect the causal stages, manipulate the feedback variables, test a misconception, and transfer the model.",
    misconceptions: [
      { belief: "A more detailed initial instruction guarantees a correct result.", correction: "Initial clarity helps, but observation and correction are still required.", diagnosticQuestion: "What changes the next action after an unexpected result?" },
    ],
    sections: [
      { id: "orient", title: "See the loop", objective: input.brief.goals[0], claimIds: ["claim-1"], blockTypes: ["prose", "system-map", "comparison"] },
      { id: "manipulate", title: "Change the signal", objective: input.brief.goals[1], claimIds: ["claim-2", "claim-3"], blockTypes: ["simulator", "prose", "quiz"] },
      { id: "ground", title: "Read the evidence", objective: "Distinguish sourced evidence from an illustrative model.", claimIds: ["claim-1", "claim-2"], blockTypes: ["evidence", "takeaway"] },
      { id: "transfer", title: "Apply the model", objective: "Apply the causal model to a new situation.", claimIds: ["claim-1", "claim-2"], blockTypes: ["exercise", "quiz"] },
    ],
    assessmentPlan: [
      { objective: input.brief.goals[0], evidence: "Learner selects the stage that closes the loop.", timing: "during" },
      { objective: input.brief.goals[1], evidence: "Learner predicts how feedback quality changes the outcome.", timing: "during" },
      { objective: "Transfer", evidence: "Learner maps a real failure to a missing signal.", timing: "after" },
    ],
  };
}

function fixtureInteractions() {
  return {
    interactions: [
      { id: "loop-map", type: "system-map", title: "The observable loop", learningPurpose: "Make the causal sequence inspectable.", variables: [], expectedObservation: "Feedback connects an observed result to the next action.", evidenceClaimIds: ["claim-1", "claim-2"] },
      { id: "signal-simulator", type: "simulator", title: "Tune the feedback signal", learningPurpose: "Show that delayed or weak feedback produces drift.", variables: [{ name: "clarity", relationship: "Higher clarity improves alignment." }, { name: "feedback", relationship: "Stronger feedback improves correction." }, { name: "delay", relationship: "Longer delay reduces loop health." }], expectedObservation: "Loop health rises with clarity and feedback and falls with delay.", evidenceClaimIds: ["claim-2", "claim-3"] },
      { id: "misconception-check", type: "quiz", title: "Find the missing signal", learningPurpose: "Diagnose whether the learner mistakes instruction detail for feedback.", variables: [], expectedObservation: "The learner chooses executable feedback over more initial prose.", evidenceClaimIds: ["claim-2"] },
    ],
  };
}

function fixtureLesson(input) {
  const { brief, sourcePack } = input;
  const title = `${brief.topic}: learn the mechanism by changing it`;
  return {
    title,
    kicker: "Generated mental model",
    summary: `A compact, evidence-led lesson for ${brief.audience} that turns ${brief.topic} into an observable causal model, a manipulated example, a misconception check, and a field exercise.`,
    duration: `${brief.durationMinutes} min`,
    level: `${brief.level} · generated`,
    objectives: brief.goals.slice(0, 4),
    sections: [
      {
        id: "orient", nav: "See the loop", number: "01", title: "Start with the mechanism", lead: "A useful mental model identifies what changes, what can be observed, and how that observation changes the next action.",
        blocks: [
          { type: "prose", eyebrow: "Core distinction", title: "Commands point; feedback steers", body: [`A command sets an initial direction, but ${brief.topic} becomes reliable only when the result can be compared with the intended outcome. That comparison turns a one-shot action into a correctable process.`, "The lesson therefore begins with the causal sequence rather than a vocabulary list. Each later interaction exposes one part of that sequence and asks the learner to predict what will happen when the signal changes."] },
          { type: "system-map", title: "The observable loop", caption: "Select each stage mentally: the loop closes only when the observation can change the next action.", nodes: [
            { id: "goal", label: "Goal", detail: "The intended outcome gives the system a target against which results can be compared.", tone: "green" },
            { id: "action", label: "Action", detail: "The current model of the problem produces a concrete action in the environment.", tone: "blue" },
            { id: "result", label: "Result", detail: "The environment produces evidence that may agree with or contradict the expectation.", tone: "purple" },
            { id: "feedback", label: "Feedback", detail: "The observed gap changes the next action instead of merely being reported.", tone: "orange" }
          ] },
          { type: "comparison", title: "Same capability, different loop", left: { label: "Open loop", score: 35, points: ["Acts from the initial interpretation", "Cannot convert a miss into a correction"] }, right: { label: "Closed loop", score: 82, points: ["Observes the actual result", "Uses the gap to choose the next action"] } }
        ]
      },
      {
        id: "manipulate", nav: "Change the signal", number: "02", title: "Manipulate the variables", lead: "A causal model becomes useful when the learner can change an input and predict the direction of the result.",
        blocks: [
          { type: "simulator", title: "Tune the feedback signal", prompt: "Move the controls and predict the direction before reading the score. The values illustrate a relationship; they are not benchmark measurements.", controls: [
            { id: "clarity", label: "Goal clarity", help: "How observable and bounded the intended result is", min: 0, max: 10, initial: 6, inverse: false },
            { id: "feedback", label: "Feedback strength", help: "How directly the result tests the intended outcome", min: 0, max: 10, initial: 5, inverse: false },
            { id: "delay", label: "Feedback delay", help: "How long the process drifts before observing the gap", min: 0, max: 10, initial: 6, inverse: true }
          ] },
          { type: "prose", eyebrow: "Interpretation", title: "Strong starts cannot replace observation", body: ["Clear intent reduces avoidable ambiguity, but it does not reveal whether the action worked. A reliable process needs both a target and a result signal.", "The simulator is deliberately qualitative. Its purpose is to make the direction of the relationship visible before the learner encounters domain-specific measurements."] },
          { type: "quiz", title: "Find the missing signal", question: "A process follows an excellent initial plan but repeats the same failure after the environment changes. What should be strengthened first?", options: [
            { label: "Make the initial plan longer", correct: false, feedback: "More initial detail does not reveal how the environment changed." },
            { label: "Add an executable result check", correct: true, feedback: "A direct check exposes the gap and gives the next action useful information." },
            { label: "Repeat the same action faster", correct: false, feedback: "Speed without a better signal accelerates the same drift." }
          ] }
        ]
      },
      {
        id: "ground", nav: "Read the evidence", number: "03", title: "Separate evidence from illustration", lead: "Generated lessons must show which statements come from sources and which devices exist only to make a relationship easier to understand.",
        blocks: [
          { type: "evidence", title: "Source-backed mechanism, illustrative scale", rows: [{ stage: "Goal is observable", rate: 45, change: "illustrative baseline" }, { stage: "Result check added", rate: 72, change: "illustrative direction" }, { stage: "Recovery state added", rate: 86, change: "illustrative direction" }], note: `Illustrative teaching model only. The mechanism is grounded in ${sourcePack.sources.map((source) => source.label).join(" and ")}; the percentages are not source measurements.` },
          { type: "takeaway", title: "Keep the epistemic boundary visible", items: ["Cite mechanisms to the source pack", "Label invented scales as illustrative", "Record evidence gaps instead of filling them with prose"] }
        ]
      },
      {
        id: "transfer", nav: "Apply it", number: "04", title: "Transfer the model", lead: "A lesson succeeds when the learner can use its causal model to diagnose a different situation without copying the worked example.",
        blocks: [
          { type: "exercise", title: "Run a loop audit", prompt: `Choose one recent failure related to ${brief.topic}. Identify the target, action, observed result, and signal that should have changed the next action.`, steps: ["Write the intended and actual results.", "Locate the point where useful information stopped flowing.", "Add the smallest observable check that closes the loop.", "Repeat the task and record whether the failure mode changed."] },
          { type: "quiz", title: "Check transfer", question: "Which change most directly converts a plausible result into evidence that the intended outcome was achieved?", options: [
            { label: "A stronger adjective in the instruction", correct: false, feedback: "Tone does not compare the actual result with the target." },
            { label: "A test tied to the definition of done", correct: true, feedback: "The test makes the result observable and actionable." },
            { label: "A larger explanation after failure", correct: false, feedback: "Explanation helps only if it is connected to an observed gap." }
          ] }
        ]
      }
    ],
    sources: sourcePack.sources.map((source) => ({ label: source.label, url: source.url })),
  };
}

export class FixtureProvider {
  constructor() { this.model = "fixture-v1"; }
  async generate({ stage, input }) {
    if (stage === "claims") return fixtureClaims(input);
    if (stage === "plan") return fixturePlan(input);
    if (stage === "interactions") return fixtureInteractions(input);
    if (stage === "lesson" || stage.startsWith("repair")) return fixtureLesson(input);
    if (stage === "evaluation") return { verdict: "pass", scores: { factualGrounding: 5, objectiveAlignment: 4, interactionIntegrity: 4, misconceptionQuality: 4, transferQuality: 4 }, issues: [], summary: "Fixture lesson satisfies the vertical-slice quality gates." };
    throw new Error(`Unknown fixture stage: ${stage}`);
  }
}
