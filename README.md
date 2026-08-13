# Learning Harness

A repository-backed AI lesson compiler and interactive renderer. A bounded brief and trusted source pack become a claim ledger, learning plan, interaction specifications, renderable lesson, evaluation report, and required human review.

## Run it

```bash
npm install
npm run dev
```

## Verify it

```bash
npm run validate:content
npm test
npm run lint
```

## Create a lesson

The repository installs one CLI, `learn`. Generation always calls a configured live model; no demo or fixture provider ships in the product.

```bash
npm link
learn doctor --provider openai
learn generate examples/lesson-brief.json --provider openai
learn status runs/reliable-agent-feedback
learn review runs/reliable-agent-feedback
```

Use either OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`) or Claude (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`). Runs are checkpointed, inspectable, and resumable. Approval is hash-bound to the exact lesson and evaluation; changing either invalidates installation. The complete workflow is documented in [`docs/GENERATOR.md`](docs/GENERATOR.md).

The renderer contract remains in [`docs/AUTHORING.md`](docs/AUTHORING.md) and [`content/lesson.schema.json`](content/lesson.schema.json).

The reference analysis and design rationale live in [`docs/REFERENCE-TEARDOWN.md`](docs/REFERENCE-TEARDOWN.md).

The phased path from the current CLI to a benchmarked, accessible, operationally hardened v1.0 is in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Benchmark against reference products

Run the dated competitor research loop:

```bash
learn benchmark run benchmarks/reference-sites
learn benchmark research benchmarks/reference-sites
```

The loop excludes missing or stale evidence, reports score coverage, surfaces reviewer disagreement, and turns verified gaps into implementation experiments. The research gate then compares implementation candidates, preserves the benchmark acceptance criteria, and emits a conditional real-data spike plan. See [`docs/BENCHMARK.md`](docs/BENCHMARK.md), the current [`benchmark report`](benchmarks/reference-sites/04-report.md), and the [`implementation plan`](benchmarks/reference-sites/06-implementation-plan.md).

## Research a textbook without an API

Create a durable topic job, then let the repository's `$research-textbook` Codex skill research and author it through the signed-in Codex experience:

```bash
npm run research:start -- \
  --topic "How Ethereum works" \
  --audience "software engineers new to blockchains" \
  --outcome "build and explain a basic smart contract"
```

The deterministic audit expands only unresolved evidence gaps, stops on configured coverage and contradiction gates, and packages validated lessons into a multi-chapter `book.json`. See [`docs/RESEARCH.md`](docs/RESEARCH.md).
