# Learning Harness authoring contract

The renderer accepts a lesson document shaped by [`content/lesson.schema.json`](../content/lesson.schema.json). A generated lesson should teach through a sequence of models and decisions, not decorate an essay after the fact.

## Generation sequence

1. **Name the transfer goal.** Finish “After this lesson, the learner can…” with an observable action.
2. **Build the causal spine.** Express the topic as 3–6 states, forces, stages, or decisions that explain one another.
3. **Choose the visual grammar.** Use a system map for flow, a comparison for contrast, an evidence chart for measured change, and a simulator when a variable changes an outcome.
4. **Create prediction points.** Ask the learner to commit to an answer before revealing an explanation. Every option needs diagnostic feedback.
5. **Expose epistemic status.** Cite evidence, label teaching models as models, and distinguish sourced measurements from illustrative numbers.
6. **End in transfer.** Give the learner a bounded exercise to perform in their own environment.

## Quality gate

A publishable lesson must satisfy all of these:

- one clear mental model appears before terminology expands;
- at least one diagram is semantic and selectable, not a screenshot;
- at least one interaction changes an explanatory result;
- each section alternates explanation with a visual, decision, or action;
- quiz feedback explains why every choice succeeds or fails;
- every quantitative claim is sourced or explicitly labeled illustrative;
- the page works with keyboard input, reduced motion, and a narrow screen;
- sources are visible at the point of trust and in the final source trail;
- the final exercise can be completed in under 30 minutes;
- content validation and the production build pass.

Run `npm run validate:content` before publishing. The validator checks structural coverage and common integrity failures; editorial review still owns factual accuracy and pedagogy.

## Available primitives

| Primitive | Use it for | Avoid it when |
| --- | --- | --- |
| `prose` | analogy, causal explanation, synthesis | a relationship is easier to scan visually |
| `system-map` | stages, flows, architecture | sequence or causality is not meaningful |
| `comparison` | before/after or competing models | the scores imply unsupported precision |
| `simulator` | variable-to-outcome relationships | the relationship cannot be stated honestly |
| `evidence` | measured or explicitly illustrative change | the learner needs mechanism before magnitude |
| `quiz` | prediction and misconception diagnosis | it only tests recall of a label |
| `takeaway` | compression after explanation | it introduces new ideas |
| `exercise` | transfer into the learner’s context | success cannot be checked |

## Suggested generation prompt

> Produce one lesson JSON document that conforms to `content/lesson.schema.json`. Teach a single transferable mental model. Use progressive disclosure: analogy → causal map → manipulated example → prediction check → evidence → field exercise. Every visual must explain a relationship, every quiz option must have diagnostic feedback, and every quantitative claim must include a source or an explicit “illustrative teaching model” note. Prefer short concrete sentences and accurate boundaries over encyclopedic coverage.
