import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { benchmarkArtifactNames, createBenchmarkJob, runBenchmarkLoop } from "../harness/benchmark.mjs";

const definition = JSON.parse(await readFile(new URL("../benchmarks/reference-sites/00-benchmark.json", import.meta.url), "utf8"));
const observations = JSON.parse(await readFile(new URL("../benchmarks/reference-sites/01-observations.json", import.meta.url), "utf8"));
const capturedClock = () => new Date("2026-08-13T21:00:00.000Z");

async function seededJob(prefix = "learning-benchmark-") {
  const jobDir = await mkdtemp(path.join(tmpdir(), prefix));
  await createBenchmarkJob({ jobDir, definition, clock: capturedClock });
  await writeFile(path.join(jobDir, benchmarkArtifactNames.observations), `${JSON.stringify(observations, null, 2)}\n`);
  return jobDir;
}

test("reference benchmark scores only evidence-backed dimensions and generates product experiments", async () => {
  const jobDir = await seededJob();
  const result = await runBenchmarkLoop({ jobDir, clock: capturedClock });
  assert.equal(result.scorecard.status, "ready");
  assert.equal(result.scorecard.targets.length, 5);
  assert.ok(result.scorecard.targets.every((target) => target.rankable));
  assert.equal(result.scorecard.targets.find((target) => target.id === "fanout").dimensions.accessibility.score, null);
  assert.ok(result.experiments.experiments.some((experiment) => experiment.dimensionId === "learner-continuity" && experiment.benchmarkTargetId === "fanout"));
  assert.ok(result.experiments.experiments.every((experiment) => experiment.acceptance.length >= 3));
  assert.match(result.report, /Evidence-backed implementation experiments/);
});

test("stale evidence is excluded and blocks benchmark readiness", async () => {
  const jobDir = await seededJob("learning-benchmark-stale-");
  const result = await runBenchmarkLoop({ jobDir, clock: () => new Date("2027-08-13T21:00:00.000Z") });
  assert.equal(result.scorecard.status, "incomplete");
  assert.ok(result.scorecard.issues.some((issue) => issue.code === "stale-evidence"));
  assert.ok(result.scorecard.targets.every((target) => target.coverage === 0));
});

test("new benchmark jobs begin unknown and cannot produce a misleading ranking", async () => {
  const jobDir = await mkdtemp(path.join(tmpdir(), "learning-benchmark-empty-"));
  await createBenchmarkJob({ jobDir, definition, clock: capturedClock });
  const result = await runBenchmarkLoop({ jobDir, clock: capturedClock });
  assert.equal(result.scorecard.status, "incomplete");
  assert.ok(result.scorecard.targets.every((target) => !target.rankable && target.overall === null));
  assert.equal(result.experiments.experiments.length, 0);
});
