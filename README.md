# Learning Harness: a CLI that compiles a brief and a source pack into a claim-ledgered interactive lesson

[![CI](https://github.com/RahilBhavan/learning-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/RahilBhavan/learning-harness/actions/workflows/ci.yml)

Learning Harness takes a lesson brief and a set of trusted sources. It calls an OpenAI or Anthropic model through a staged pipeline and writes every stage to disk as a JSON artifact. The output is a claim ledger, a learning plan, interaction specifications, a renderable lesson and an evaluation report. A person must approve the lesson before it can be installed. A React app renders the installed lesson.

**Offline example:** [`examples/offline-demo/`](examples/offline-demo/) holds one complete run that needs no API key. A scripted stand-in for the model produced it, so it shows the artifact shapes and gates, not model quality. See [Offline demo](#offline-demo).

## What it does

- Runs a pipeline of 9 artifacts: brief, source pack, claim ledger, learning plan, interaction specs, lesson, evaluation report, human review worksheet and approval (`harness/contracts.mjs`, `harness/pipeline.mjs`).
- Checks the shape of the claims, plan, interactions, lesson and evaluation outputs before saving them (`assertShape` in `harness/pipeline.mjs`). It validates the brief on entry (`validateBrief`) and sends the model a strict JSON schema for each model stage.
- Requires each claim to cite source IDs and rejects citations to sources that are not in the source pack. It also rejects lesson sources that are not in the pack (`evaluateArtifacts` in `harness/validate.mjs`).
- Reuses completed stages on a rerun. It refuses to reuse them if the brief, provider, model or prompt version changed, unless you pass `--force`.
- Allows one bounded repair attempt when a quality gate fails (`--max-repairs`, default 1).
- Binds approval to SHA-256 hashes of the lesson and the evaluation. Editing either file invalidates the approval, and `learn install` refuses to run without a valid one (`harness/run-store.mjs`).
- Calls OpenAI (`POST /v1/responses`) and Anthropic (`POST /v1/messages`) with plain `fetch`, up to three attempts each (`harness/providers/`).

## How it works

`bin/learn.mjs` is the CLI. `harness/pipeline.mjs` runs the stages in order and writes `00-brief.json` to `08-approval.json` plus `run.json` into a run directory. `harness/source-pack.mjs` builds the source pack from excerpts in the brief, or fetches HTML and plain-text URLs. `harness/validate.mjs` holds the deterministic gates. `app/` and `worker/` render a lesson with vinext (a Vite-based Next-style framework) on Cloudflare Workers tooling. `harness/benchmark.mjs` and `harness/research.mjs` are separate tooling for a competitor benchmark and a textbook research workflow.

## Run it

Prerequisites: Node 22 (`.nvmrc`; `package.json` requires 22.13 or later) and npm 10.

```bash
nvm use            # or any Node 22 install
npm ci
npm test           # content validation, 23 node tests, build, rendered-HTML tests
npm run lint
npm run dev        # local lesson viewer
```

Observed on 2026-10-24 with Node 22.23.4: `npm test` ran 23 tests (10 harness and CLI, 5 research, 5 benchmark, 3 rendered HTML), all passing, and `npm run lint` was clean. CI runs the same steps on Node 22.

If `npm ci` fails inside `sharp` on a machine that has a system libvips installed, run it with `SHARP_IGNORE_GLOBAL_LIBVIPS=1`. CI sets this variable. `sharp` is a dependency of `miniflare`, not of this code.

Generate a real lesson. This calls a paid API and needs a provider key and a model name:

```bash
npm link
export OPENAI_API_KEY=...  OPENAI_MODEL=...      # or ANTHROPIC_API_KEY and ANTHROPIC_MODEL
learn doctor --provider openai
learn generate examples/lesson-brief.json --provider openai
learn status runs/reliable-agent-feedback
learn review runs/reliable-agent-feedback
learn approve runs/reliable-agent-feedback --reviewer "Your Name"
learn install runs/reliable-agent-feedback --to content/my-lesson.json
```

The full workflow is in [`docs/GENERATOR.md`](docs/GENERATOR.md).

### Offline demo

```bash
npm run demo:offline
node bin/learn.mjs status examples/offline-demo
```

`scripts/offline-demo.mjs` runs the real pipeline on the bundled brief with `tests/helpers/scripted-provider.mjs`, which returns fixed artifacts built from `content/harness-control-loop.json`. It makes no network calls. The `learn` CLI has no fixture provider, and CI regenerates the demo and fails if it differs from the committed files. The run stops at `awaiting-human-review` and is not approved.

## Repository layout

- `bin/`: the `learn` CLI.
- `harness/`: pipeline, contracts, validators, run store, source pack, providers, benchmark and research tooling.
- `app/`, `worker/`: lesson renderer and review page.
- `content/`: lesson JSON schema and the reference lesson.
- `examples/`: sample brief and the offline demo run.
- `benchmarks/`: dated competitor benchmark data and reports.
- `scripts/`: content validation, offline demo, research and generation entry points.
- `tests/`: `node --test` suites.

## Documentation

- [`docs/GENERATOR.md`](docs/GENERATOR.md): operator guide for the pipeline, claim statuses and approval.
- [`docs/AUTHORING.md`](docs/AUTHORING.md): the lesson renderer contract.
- [`docs/BENCHMARK.md`](docs/BENCHMARK.md): the reference-site benchmark loop.
- [`docs/RESEARCH.md`](docs/RESEARCH.md): the textbook research workflow that needs no API.
- [`docs/REFERENCE-TEARDOWN.md`](docs/REFERENCE-TEARDOWN.md): design rationale from reference products.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): proposed path to v1.0. It is a plan, not shipped behavior.

## Scope and limits

- Independent solo project. It is not affiliated with OpenAI or Anthropic.
- No calibrated benchmark exists. The benchmark loop under `benchmarks/` scores reference sites from dated evidence. It has not been used to measure lesson quality.
- No learner study has been run. Nothing here shows that the lessons teach better than other material.
- The repository has no committed output from a live model run. The offline demo comes from a scripted provider.
- The stage checks are hand-written shape checks, not full JSON Schema validation of every artifact. The source-pack, review and approval stages have no model-output check.
- The claim ledger records which source IDs a claim cites. It does not verify that the source text supports the claim, and it has no quote locators.
- Sources are curated by the brief. The tool does not search the web, and it rejects PDFs and other binary sources unless the brief supplies an excerpt.
- Approval is a local hash check, not an access-control system.

## License

MIT. See [LICENSE](LICENSE).

Part of [Rahil Bhavan's projects](https://github.com/RahilBhavan).
