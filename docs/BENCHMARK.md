# Competitor research and implementation loop

The benchmark is a dated evidence system, not a permanent leaderboard. It compares observable product behavior, records uncertainty, and turns verified Learning Harness gaps into implementation experiments with acceptance criteria and a mandatory rerun rule.

## Run the seeded reference benchmark

```bash
learn benchmark run benchmarks/reference-sites
learn benchmark status benchmarks/reference-sites
```

The seeded benchmark covers:

- [Modern Microprocessors](https://www.lighterra.com/papers/modernmicroprocessors/)
- [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/)
- [Fanout AI](https://fanout.sh/ai/overview)
- [Machine Learning Visualized](https://ml-visualized.com/index.html)
- the current Learning Harness repository and deployed learner experience

The current report is [`benchmarks/reference-sites/04-report.md`](../benchmarks/reference-sites/04-report.md). Initial ratings come from one research pass and are provisional until a second reviewer independently scores the observations. Unknown accessibility ratings are intentionally excluded instead of inferred.

## Start a fresh cycle

```bash
learn benchmark init --job-dir benchmarks/2026-q4
```

This copies the versioned rubric and creates one unknown observation for every target and dimension. Update `01-observations.json` through direct product inspection. Every observed score requires:

- a named reviewer;
- an integer score from 0 to 4;
- a concise observation rather than marketing language;
- a URL or repository path;
- an exact visible locator;
- a capture timestamp.

Then run:

```bash
learn benchmark run benchmarks/2026-q4
```

The loop writes:

| Artifact | Purpose |
| --- | --- |
| `00-benchmark.json` | Targets, rubric, weights, evidence policy, and implementation hypotheses |
| `01-observations.json` | Append-only reviewer evidence and scores |
| `02-scorecard.json` | Coverage-aware product and competitor scores plus integrity issues |
| `03-experiments.json` | Verified product gaps translated into implementation work |
| `04-report.md` | Human-readable comparison and acceptance checklist |
| `run.json` | Durable benchmark history |

## Integrity rules

- Unknown is not zero. Missing evidence is excluded.
- Evidence older than the configured maximum age is excluded.
- Targets below the evidence-coverage threshold are not rankable.
- A zero score still requires evidence that the capability was not observed in the declared inspection scope.
- Reviewer differences of two or more points require adjudication.
- Scores must describe the sampled surface. Do not generalize a single lesson to an entire product without broader evidence.
- Product work is proposed only when Learning Harness trails an observed competitor score.
- An experiment is not complete until its acceptance checks pass and the affected competitors are rescored with fresh evidence.

## Current evidence-backed priorities

The first run produced three implementation experiments:

1. local-first learner progress, resume state, and notes, benchmarked against Fanout;
2. concept-aware course navigation and search, benchmarked against Learn Harness Engineering;
3. a broader declarative visual grammar, benchmarked against Modern Microprocessors.

Learning Harness currently matches or leads the sampled competitors in interaction, active assessment, reproducibility, and explanation pacing. Those are provisional research findings, not universal claims; preserve them with regression tests while closing the verified gaps.
