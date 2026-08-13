# Interactive learning product benchmark

Generated: 2026-08-13T19:28:25.192Z

Status: **ready**

Scores use a 0–4 rubric. A score is excluded when evidence is missing, stale, or below the reviewer threshold. Overall scores are not rankable below 80% evidence coverage.

## Scorecard

| Target | Overall | Coverage | Structure & navigation | Explanation & pacing | Visual models | Interactive learning | Active assessment | Evidence & trust | Reproducibility | Learner continuity | Accessibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Learning Harness | 3.11/4 | 100% | 2.0 (adequate) | 4.0 (leading) | 3.0 (strong) | 4.0 (leading) | 4.0 (leading) | 3.0 (strong) | 4.0 (leading) | 1.0 (rudimentary) | 3.0 (strong) |
| Modern Microprocessors | 1.88/4 | 89% | 3.0 (strong) | 4.0 (leading) | 4.0 (leading) | 0.0 (absent) | 0.0 (absent) | 3.0 (strong) | 1.0 (rudimentary) | 0.0 (absent) | ? |
| Learn Harness Engineering | 2.63/4 | 89% | 4.0 (leading) | 3.0 (strong) | 3.0 (strong) | 1.0 (rudimentary) | 2.0 (adequate) | 3.0 (strong) | 4.0 (leading) | 1.0 (rudimentary) | ? |
| Fanout AI | 2.00/4 | 89% | 4.0 (leading) | 2.0 (adequate) | 2.0 (adequate) | 1.0 (rudimentary) | 1.0 (rudimentary) | 1.0 (rudimentary) | 1.0 (rudimentary) | 4.0 (leading) | ? |
| Machine Learning Visualized | 2.63/4 | 89% | 3.0 (strong) | 2.0 (adequate) | 4.0 (leading) | 4.0 (leading) | 1.0 (rudimentary) | 2.0 (adequate) | 4.0 (leading) | 1.0 (rudimentary) | ? |

## Research integrity

- **warning: insufficient-reviewers** — Modern Microprocessors / Accessibility has 0 reviewer(s); 1 required before that dimension can be scored.
- **warning: insufficient-reviewers** — Learn Harness Engineering / Accessibility has 0 reviewer(s); 1 required before that dimension can be scored.
- **warning: insufficient-reviewers** — Fanout AI / Accessibility has 0 reviewer(s); 1 required before that dimension can be scored.
- **warning: insufficient-reviewers** — Machine Learning Visualized / Accessibility has 0 reviewer(s); 1 required before that dimension can be scored.

## Evidence-backed implementation experiments

### HIGH · Learner continuity

Benchmark: **Fanout AI** · gap 3.00

Local-first progress and resume cues will improve multi-session completion without requiring an account.

Implementation direction: Add versioned local progress, section mastery, notes export, and explicit resume state before any hosted account system.

Acceptance:
- [ ] Progress survives reload without authentication
- [ ] Content-version changes do not silently preserve invalid mastery
- [ ] Learners can export and delete their local state

Rerun rule: Re-score learning-harness and fanout on learner-continuity with fresh evidence and at least 2 reviewers.

### HIGH · Structure & navigation

Benchmark: **Learn Harness Engineering** · gap 2.00

A course shell with concept-aware navigation will reduce orientation cost and abandonment.

Implementation direction: Compile book and concept graphs into persistent course navigation, search, prerequisites, and next/previous actions.

Acceptance:
- [ ] A learner can locate the current concept and prerequisite path
- [ ] Search reaches lessons, concepts, and sources
- [ ] Every lesson exposes a deterministic next action

Rerun rule: Re-score learning-harness and walkinglabs on structure-navigation with fresh evidence and at least 2 reviewers.

### MEDIUM · Visual models

Benchmark: **Modern Microprocessors** · gap 1.00

A broader semantic visual grammar will let generated lessons explain more mechanisms without screenshots or arbitrary code.

Implementation direction: Add declarative timeline, causal graph, state machine, parameter plot, and annotated-code primitives with static fallbacks.

Acceptance:
- [ ] Every visual states the relationship it explains
- [ ] All visuals have text equivalents
- [ ] Primitive contracts pass narrow-screen and keyboard tests

Rerun rule: Re-score learning-harness and lighterra on visual-models with fresh evidence and at least 2 reviewers.
