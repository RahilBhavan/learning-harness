# Learning Harness

A schema-driven prototype for interactive, evidence-led technical lessons. The first lesson demonstrates semantic diagrams, a parameter simulator, comparisons, evidence labeling, misconception checks, progress cues, and a field exercise.

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

1. Read [`docs/AUTHORING.md`](docs/AUTHORING.md).
2. Generate a document that conforms to [`content/lesson.schema.json`](content/lesson.schema.json).
3. Validate it with `npm run validate:content`.
4. Import it from `app/page.tsx` (multi-lesson routing is intentionally deferred until the lesson grammar has been tested with learners).

The reference analysis and design rationale live in [`docs/REFERENCE-TEARDOWN.md`](docs/REFERENCE-TEARDOWN.md).
