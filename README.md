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

Run the deterministic offline pipeline:

```bash
npm run lesson:generate -- --brief examples/lesson-brief.json --provider fixture
```

For an AI-generated lesson, set `OPENAI_API_KEY` and `OPENAI_MODEL`, then use `--provider openai`. The complete artifact contract, resume behavior, source policy, repair loop, and human installation gate are documented in [`docs/GENERATOR.md`](docs/GENERATOR.md).

The renderer contract remains in [`docs/AUTHORING.md`](docs/AUTHORING.md) and [`content/lesson.schema.json`](content/lesson.schema.json).

The reference analysis and design rationale live in [`docs/REFERENCE-TEARDOWN.md`](docs/REFERENCE-TEARDOWN.md).
