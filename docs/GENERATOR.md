# Lesson compiler operator guide

The lesson compiler turns a bounded brief and trusted source material into inspectable run artifacts. It is intentionally a staged compiler rather than a chat agent: every decision is written to disk, every model response is structured, and installation requires a human checkbox.

## Research translated into constraints

| Research | Operational rule in the harness |
| --- | --- |
| [ICAP framework](https://doi.org/10.1080/00461520.2014.965823) | Plans must move beyond exposition into prediction, manipulation, explanation, or transfer. |
| [Retrieval practice](https://pubmed.ncbi.nlm.nih.gov/16507066/) | Quizzes ask for a decision before revealing diagnostic feedback. |
| [Active learning in STEM](https://www.pnas.org/doi/10.1073/pnas.1319030111) | Every lesson must include learner action and a field exercise. |
| [Cognitive theory of multimedia learning](https://doi.org/10.1207/S15326985EP3801_6) | Interactions must expose a relationship and remain adjacent to its explanation; decoration does not satisfy the gate. |
| [Worked-example effect](https://doi.org/10.1207/s1532690xci0201_3) | The causal model and manipulated example precede independent transfer. |
| [OpenAI harness engineering](https://openai.com/index/harness-engineering/) | Repository artifacts, executable checks, and explicit intent form the system of record. |
| [Anthropic long-running agent harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Stages checkpoint durable progress and can resume without reconstructing conversational state. |

[STORM](https://arxiv.org/abs/2402.14207) informs the separation between research, outlining, and writing. [DSPy](https://dspy.ai/) is a candidate for later prompt optimization after a human-rated benchmark exists; neither is a runtime dependency in this first vertical slice.

## Run the offline demonstration

```bash
npm run lesson:generate -- \
  --brief examples/lesson-brief.json \
  --provider fixture
```

The fixture provider makes no network calls. It exercises source capture, artifact checkpointing, deterministic evaluation, the repair loop, and the human-review gate.

## Run with OpenAI

Set `OPENAI_API_KEY` and an explicit `OPENAI_MODEL`, then run:

```bash
npm run lesson:generate -- \
  --brief examples/lesson-brief.json \
  --provider openai
```

The adapter uses the Responses API with strict JSON Schema output. It does not silently choose or upgrade a model. See the official [Structured model outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

No credentials are written to run artifacts. Source files, prompts, model name, prompt version, stage status, failures, and evaluations are recorded.

## Run artifacts

Each run is stored under `runs/<brief-id>/` by default:

| Artifact | Purpose |
| --- | --- |
| `00-brief.json` | Audience, objectives, scope, duration, and trusted sources |
| `01-source-pack.json` | Captured text, URL, extraction method, truncation status, and content hash |
| `02-claim-ledger.json` | Atomic claims with epistemic status and source IDs |
| `03-learning-plan.json` | Mental model, misconceptions, sequence, and aligned assessments |
| `04-interaction-specs.json` | Learning purpose, variables, expected observations, and evidence links |
| `05-lesson.json` | Renderable lesson document |
| `06-evaluation-report.json` | Deterministic gates, independent model review, and repair count |
| `07-human-review.md` | Required editorial, factual, interaction, and accessibility checklist |
| `run.json` | Resumable run manifest and failure record |

Completed artifacts are reused on rerun. Use `--force` to intentionally regenerate them. A run performs at most one repair by default; `--max-repairs` is bounded from zero to three so a bad design cannot enter an unobserved rewrite loop.

## Source policy

Each brief needs at least two trusted HTTP(S) sources. Supply `excerpt` when the source is a PDF, paywalled, authenticated, or otherwise unsuitable for direct text extraction. Plain HTML and text sources can be fetched automatically. The first version deliberately rejects binary formats rather than pretending to parse them.

Claims have one of five statuses:

- `supported`: directly backed by source IDs;
- `inferred`: a transparent synthesis of supported material;
- `illustrative`: a teaching device, not an empirical measurement;
- `disputed`: sources conflict or the claim needs qualification;
- `missing`: the source pack cannot establish the claim.

## Human installation gate

Open [http://localhost:3001/review](http://localhost:3001/review) while the development server is running, then choose the run's `05-lesson.json`. The preview is parsed locally in the browser and is not uploaded or installed.

After reading the artifacts and exercising the lesson in the review workspace, check this line in `07-human-review.md`:

```markdown
- [x] Approve for installation
```

Then rerun with an explicit target:

```bash
npm run lesson:generate -- \
  --brief examples/lesson-brief.json \
  --provider openai \
  --install content/harness-control-loop.json
```

Installation is refused when automated gates fail or the human checkbox is absent. Deployment remains a separate explicit action.

## Current boundary

This vertical slice starts from a curated brief rather than autonomously searching the open web. That boundary is deliberate: trustworthy research requires a source-discovery policy, primary-source ranking, PDF extraction, and citation verification that should be evaluated independently before it can feed production lessons.
