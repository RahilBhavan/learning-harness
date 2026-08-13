# Interactive learning product benchmark: implementation research plan

Generated: 2026-08-13T19:42:46.559Z

Status: **ready-for-spike**

Recommendations are conditional until their real-data spike passes. Candidate means are decision aids, not substitutes for the documented constraints, evidence, or acceptance checks.

## Research integrity

None.

## 1. Learner continuity

Benchmark: **Fanout AI** · gap 3.00 · priority high

Owner: Learning Harness maintainers

### Candidate comparison

| Candidate | Fit | Delivery | Maintainability | Accessibility | Portability | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Web Storage | 3 | 5 | 4 | 4 | 5 | 4.20 |
| idb | 5 | 4 | 4 | 4 | 4 | 4.20 |
| Native IndexedDB | 5 | 2 | 3 | 4 | 5 | 3.80 |

Conditional recommendation: **idb**. It preserves a transactional, versioned local-first data model while reducing adapter complexity. Dependency adoption remains blocked until the spike measures bundle cost, migration behavior, and recovery from invalid state.

Constraints:
- Remain useful without an account or network connection
- Version persisted state against the lesson content version
- Provide explicit export and deletion controls
- Do not store credentials, source secrets, or provider responses

### Real-data spike

Question: Can idb persist versioned progress, mastery, resume position, and learner notes without corrupting state across real lesson revisions?

Steps:
- [ ] Use an existing generated lesson artifact and its real content version; do not create demo learner data
- [ ] Implement the same typed persistence adapter against native IndexedDB and idb on isolated branches
- [ ] Exercise reload, upgrade, downgrade rejection, concurrent-tab writes, export, deletion, and invalid-record recovery
- [ ] Record compressed bundle delta, migration duration, error behavior, and browser results

Pass criteria:
- [ ] Progress survives reload without authentication
- [ ] Content-version changes do not silently preserve invalid mastery
- [ ] Learners can export and delete their local state
- [ ] All measurements are captured from the current application and real generated lesson artifacts

Competitor rerun: Re-score learning-harness and fanout on learner-continuity with fresh evidence and at least 2 reviewers.

## 2. Structure & navigation

Benchmark: **Learn Harness Engineering** · gap 2.00 · priority high

Owner: Learning Harness maintainers

### Candidate comparison

| Candidate | Fit | Delivery | Maintainability | Accessibility | Portability | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Compiler-emitted concept index | 5 | 3 | 4 | 5 | 5 | 4.40 |
| Pagefind | 4 | 4 | 5 | 4 | 5 | 4.40 |

Conditional recommendation: **Compiler-emitted concept index**. The content graph contains concepts and prerequisites that rendered-page search cannot infer reliably. Start with the compiler-owned semantic index, then rerun Pagefind at a larger corpus size if hand-owned ranking or payload size becomes the limiting factor.

Constraints:
- Index only source-grounded fields emitted by the compiler
- Keep navigation deterministic and usable without a hosted search service
- Support keyboard operation and meaningful empty-result states
- Do not expose private research artifacts in the browser index

### Real-data spike

Question: Can a compiler-emitted index make every currently generated lesson, concept, prerequisite, and cited source reachable with deterministic keyboard navigation?

Steps:
- [ ] Build the index only from existing validated lesson and research artifacts
- [ ] Add persistent course position, prerequisite breadcrumbs, next and previous actions, and search result explanations
- [ ] Measure index size, query latency, zero-result behavior, keyboard flow, and source-field leakage
- [ ] Run the same real corpus through Pagefind's Node API and record the comparative measurements

Pass criteria:
- [ ] A learner can locate the current concept and prerequisite path
- [ ] Search reaches lessons, concepts, and sources
- [ ] Every lesson exposes a deterministic next action
- [ ] The browser index contains no provider prompts, private notes, or unapproved research artifacts

Competitor rerun: Re-score learning-harness and walkinglabs on structure-navigation with fresh evidence and at least 2 reviewers.

## 3. Visual models

Benchmark: **Modern Microprocessors** · gap 1.00 · priority medium

Owner: Learning Harness maintainers

### Candidate comparison

| Candidate | Fit | Delivery | Maintainability | Accessibility | Portability | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vega-Lite | 3 | 4 | 5 | 4 | 5 | 4.20 |
| Hybrid semantic visual grammar | 5 | 3 | 4 | 5 | 4 | 4.20 |
| Custom semantic SVG primitives | 5 | 2 | 3 | 5 | 5 | 4.00 |

Conditional recommendation: **Hybrid semantic visual grammar**. One generic diagram library would blur the distinction between quantitative encodings and mechanism topology. The hybrid keeps the generated contract semantic while avoiding custom scale and plotting machinery where Vega-Lite is strongest.

Constraints:
- Every visual must declare the relationship it teaches
- Every visual needs a complete text equivalent and static fallback
- Generated content may select only allowlisted declarative primitives
- Quantitative scales and topology diagrams require different semantics

### Real-data spike

Question: Can one real mechanism be expressed as an accessible custom state or causal diagram and one real parameter relationship as Vega-Lite without arbitrary generated code?

Steps:
- [ ] Select two relationships already supported by claims in the current research package
- [ ] Render the topology relationship with a new allowlisted semantic primitive and the quantitative relationship with a restricted Vega-Lite spec
- [ ] Verify schema rejection, static fallback, text equivalence, keyboard behavior, narrow layout, and reduced motion
- [ ] Measure compressed bundle delta and renderer execution time before recommending a dependency

Pass criteria:
- [ ] Every visual states the relationship it explains
- [ ] All visuals have text equivalents
- [ ] Primitive contracts pass narrow-screen and keyboard tests
- [ ] Generated lesson JSON cannot inject code, event handlers, remote data, or an unapproved Vega transform

Competitor rerun: Re-score learning-harness and lighterra on visual-models with fresh evidence and at least 2 reviewers.
