# Reference teardown: how the four sites teach

Reviewed August 13, 2026. This is a pattern analysis, not a request to copy visual assets or prose.

## What each reference does unusually well

### [Modern Microprocessors — A 90-Minute Guide](https://www.lighterra.com/papers/modernmicroprocessors/)

- **Pacing:** a dense, informal narrative keeps asking the next natural question (“How can this be?”) and immediately answers it.
- **Visual cadence:** roughly every new mechanism gets a compact labeled figure. Sequential, pipelined, superscalar, and cache diagrams form a visual argument rather than isolated decoration.
- **Compression:** tables ground claims in real processors while the prose stays conversational.
- **Weakness to improve:** most figures are static raster images with missing alt text; the long page offers little active retrieval or learner state.

### [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/)

- **Information architecture:** persistent course navigation, on-page headings, next/previous links, search, language switching, and clear lecture/project/library tracks make a large body of material tractable.
- **Lesson pattern:** analogy → core concepts → named model → story → takeaways → reading → exercises.
- **Diagrams:** Mermaid provides semantic, fullscreen system maps with low authoring cost.
- **Weakness to improve:** dense sections remain mostly read-only; diagrams explain structure but rarely let the learner manipulate it.

### [Fanout AI curriculum](https://fanout.sh/ai/overview)

- **Packaging:** a numbered, modular curriculum makes scope, lesson count, availability, and progression obvious.
- **Lesson chrome:** course/section identity, workspace navigation, search, video, notes, progress, and completion cues keep the learner oriented.
- **Progressive disclosure:** free lessons communicate the shape of the larger learning path without dumping every detail into one page.
- **Weakness to improve:** the sampled Gradients lesson is extremely compressed and video-dependent; the surrounding catalog can compete with the lesson itself.

### [Machine Learning Visualized](https://ml-visualized.com/index.html)

- **Executable explanation:** notebook-derived figures show optimization and model training over time, while interactive pages embed live Marimo notebooks.
- **Reproducibility:** source notebooks and downloads let advanced learners inspect how a visualization was produced.
- **Domain fit:** motion and parameter controls match the subject—the learner sees convergence instead of only reading its definition.
- **Weakness to improve:** the interactive pages provide little scaffolding, prediction, or interpretation around the embedded tool.

## Shared transmission pattern

All four succeed by turning an abstract topic into a navigable sequence of representations:

1. **Orient:** define scope, time, and the learner’s route.
2. **Anchor:** start from an analogy, motivating failure, or concrete result.
3. **Model:** name the causal mechanism and show it visually.
4. **Vary:** compare states or manipulate parameters.
5. **Ground:** connect the model to measurements, examples, or executable artifacts.
6. **Transfer:** point to the next lesson, source, project, or exercise.

## Synthesis implemented here

The first Learning Harness prototype combines Lighterra’s question-driven pacing and diagram density, Learn Harness Engineering’s structured course navigation, Fanout’s progression cues, and ML Visualized’s manipulated models. It adds five missing safeguards:

- a schema so generated lessons use consistent pedagogical primitives;
- prediction checks with feedback for every option;
- explicit evidence/illustration labels;
- accessible semantic diagrams built from page elements, not unlabeled images;
- a field exercise that makes transfer—and therefore lesson success—observable.

## Next experiments

The most valuable next iteration is not more styling. Test one generated lesson with real learners and measure: time to first correct mental model, quiz misconception patterns, simulator use, exercise completion, and where readers abandon the page. Use those signals to tune the authoring contract before adding more primitive types.
