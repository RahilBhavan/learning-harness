import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const benchmarkArtifactNames = {
  definition: "00-benchmark.json",
  observations: "01-observations.json",
  scorecard: "02-scorecard.json",
  experiments: "03-experiments.json",
  report: "04-report.md",
  run: "run.json",
};

const DAY_MS = 86_400_000;

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => seen.has(value) || !seen.add(value));
}

function scoreLabel(score) {
  if (score === null) return "unknown";
  return ["absent", "rudimentary", "adequate", "strong", "leading"][Math.round(score)] ?? "unknown";
}

function validateDefinition(definition) {
  const errors = [];
  if (!definition?.id || !Array.isArray(definition.targets) || !Array.isArray(definition.dimensions)) errors.push("Benchmark needs id, targets, and dimensions.");
  if (!definition.targets?.some((target) => target.role === "product")) errors.push("Benchmark needs one product target.");
  if (definition.targets?.filter((target) => target.role === "product").length !== 1) errors.push("Benchmark must have exactly one product target.");
  for (const id of duplicates((definition.targets ?? []).map((target) => target.id))) errors.push(`Duplicate target id: ${id}`);
  for (const id of duplicates((definition.dimensions ?? []).map((dimension) => dimension.id))) errors.push(`Duplicate dimension id: ${id}`);
  for (const dimension of definition.dimensions ?? []) {
    if (!dimension.id || !dimension.label || !dimension.question || !Number.isFinite(dimension.weight) || dimension.weight <= 0) errors.push(`Invalid dimension: ${dimension.id ?? "unknown"}`);
    if (!dimension.implementation?.hypothesis || !dimension.implementation?.direction || !Array.isArray(dimension.implementation?.acceptance)) errors.push(`Dimension ${dimension.id} needs an implementation hypothesis, direction, and acceptance checks.`);
  }
  if (!(definition.minimumEvidenceCoverage > 0 && definition.minimumEvidenceCoverage <= 1)) errors.push("minimumEvidenceCoverage must be greater than zero and at most one.");
  if (!Number.isInteger(definition.minimumReviewers) || definition.minimumReviewers < 1) errors.push("minimumReviewers must be a positive integer.");
  if (!Number.isInteger(definition.maxEvidenceAgeDays) || definition.maxEvidenceAgeDays < 1) errors.push("maxEvidenceAgeDays must be a positive integer.");
  return errors;
}

export async function createBenchmarkJob({ jobDir, definition, clock = () => new Date() }) {
  const errors = validateDefinition(definition);
  if (errors.length) throw new Error(`Invalid benchmark:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  await mkdir(jobDir, { recursive: true });
  try {
    await readFile(path.join(jobDir, benchmarkArtifactNames.definition));
    throw new Error(`Benchmark job already exists at ${jobDir}.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const createdAt = clock().toISOString();
  const template = {
    version: 1,
    observations: definition.targets.flatMap((target) => definition.dimensions.map((dimension) => ({
      id: `${target.id}--${dimension.id}--reviewer`,
      targetId: target.id,
      dimensionId: dimension.id,
      reviewer: "replace-with-reviewer-name",
      status: "unknown",
      score: null,
      summary: "Evidence not collected yet.",
      evidence: [],
    }))),
  };
  await writeJson(path.join(jobDir, benchmarkArtifactNames.definition), definition);
  await writeJson(path.join(jobDir, benchmarkArtifactNames.observations), template);
  await writeJson(path.join(jobDir, benchmarkArtifactNames.run), { id: definition.id, status: "initialized", createdAt, updatedAt: createdAt, runs: [] });
  return { jobDir, definition };
}

function evidenceIsFresh(evidence, maxAgeDays, now) {
  if (!evidence?.capturedAt) return false;
  const captured = Date.parse(evidence.capturedAt);
  return Number.isFinite(captured) && captured <= now.getTime() && now.getTime() - captured <= maxAgeDays * DAY_MS;
}

function validateObservation(observation, targetIds, dimensionIds, maxAgeDays, now) {
  const errors = [];
  if (!observation.id || !targetIds.has(observation.targetId) || !dimensionIds.has(observation.dimensionId) || !observation.reviewer?.trim()) errors.push("missing or unknown identity fields");
  if (!['observed', 'unknown'].includes(observation.status)) errors.push("status must be observed or unknown");
  if (observation.status === "observed" && (!Number.isInteger(observation.score) || observation.score < 0 || observation.score > 4)) errors.push("observed score must be an integer from 0 to 4");
  if (observation.status === "unknown" && observation.score !== null) errors.push("unknown observations must use a null score");
  if (!observation.summary?.trim()) errors.push("summary is required");
  if (!Array.isArray(observation.evidence)) errors.push("evidence must be an array");
  if (observation.status === "observed" && !observation.evidence?.length) errors.push("observed scores require evidence");
  for (const evidence of observation.evidence ?? []) {
    if (!evidence.locator?.trim() || (!evidence.url && !evidence.path)) errors.push("evidence needs url or path plus a locator");
    if (evidence.url) {
      try { if (!['http:', 'https:'].includes(new URL(evidence.url).protocol)) throw new Error(); } catch { errors.push(`invalid evidence URL: ${evidence.url}`); }
    }
  }
  const fresh = observation.status === "observed" && observation.evidence.some((evidence) => evidenceIsFresh(evidence, maxAgeDays, now));
  return { errors, fresh };
}

function buildExperiments(definition, scorecard) {
  const product = definition.targets.find((target) => target.role === "product");
  const competitors = definition.targets.filter((target) => target.role === "competitor");
  const experiments = [];
  for (const dimension of definition.dimensions) {
    const productScore = scorecard.targets.find((target) => target.id === product.id)?.dimensions[dimension.id]?.score ?? null;
    const observedCompetitors = competitors.map((target) => ({
      target,
      result: scorecard.targets.find((entry) => entry.id === target.id)?.dimensions[dimension.id],
    })).filter((entry) => entry.result?.score !== null);
    if (productScore === null || !observedCompetitors.length) continue;
    const leader = observedCompetitors.sort((left, right) => right.result.score - left.result.score)[0];
    const gap = Number((leader.result.score - productScore).toFixed(2));
    if (gap <= 0) continue;
    experiments.push({
      id: `experiment-${dimension.id}`,
      dimensionId: dimension.id,
      priority: gap >= 2 ? "high" : "medium",
      status: "proposed",
      gap,
      productScore,
      benchmarkScore: leader.result.score,
      benchmarkTargetId: leader.target.id,
      hypothesis: dimension.implementation.hypothesis,
      implementationDirection: dimension.implementation.direction,
      acceptance: dimension.implementation.acceptance,
      rerun: `Re-score ${product.id} and ${leader.target.id} on ${dimension.id} with fresh evidence and at least ${Math.max(2, definition.minimumReviewers)} reviewers.`,
    });
  }
  return experiments.sort((left, right) => (left.priority === right.priority ? right.gap - left.gap : left.priority === "high" ? -1 : 1));
}

function renderReport(definition, scorecard, experiments) {
  const headers = ["Target", "Overall", "Coverage", ...definition.dimensions.map((dimension) => dimension.label)];
  const separator = headers.map(() => "---");
  const rows = scorecard.targets.map((target) => [
    target.label,
    target.rankable ? `${target.overall.toFixed(2)}/4` : "not rankable",
    `${Math.round(target.coverage * 100)}%`,
    ...definition.dimensions.map((dimension) => {
      const result = target.dimensions[dimension.id];
      return result.score === null ? "?" : `${result.score.toFixed(1)} (${scoreLabel(result.score)})`;
    }),
  ]);
  const experimentLines = experiments.length ? experiments.map((experiment) => `### ${experiment.priority.toUpperCase()} · ${definition.dimensions.find((dimension) => dimension.id === experiment.dimensionId).label}\n\nBenchmark: **${definition.targets.find((target) => target.id === experiment.benchmarkTargetId).label}** · gap ${experiment.gap.toFixed(2)}\n\n${experiment.hypothesis}\n\nImplementation direction: ${experiment.implementationDirection}\n\nAcceptance:\n${experiment.acceptance.map((item) => `- [ ] ${item}`).join("\n")}\n\nRerun rule: ${experiment.rerun}`).join("\n\n") : "No evidence-backed product gaps are currently scored.";
  const issueLines = scorecard.issues.length ? scorecard.issues.map((entry) => `- **${entry.severity}: ${entry.code}** — ${entry.message}`).join("\n") : "None.";
  return `# ${definition.title}\n\nGenerated: ${scorecard.generatedAt}\n\nStatus: **${scorecard.status}**\n\nScores use a 0–4 rubric. A score is excluded when evidence is missing, stale, or below the reviewer threshold. Overall scores are not rankable below ${Math.round(definition.minimumEvidenceCoverage * 100)}% evidence coverage.\n\n## Scorecard\n\n| ${headers.join(" | ")} |\n| ${separator.join(" | ")} |\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n\n## Research integrity\n\n${issueLines}\n\n## Evidence-backed implementation experiments\n\n${experimentLines}\n`;
}

export async function runBenchmarkLoop({ jobDir, clock = () => new Date() }) {
  const now = clock();
  const [definition, observationFile, previousRun] = await Promise.all([
    readJson(path.join(jobDir, benchmarkArtifactNames.definition)),
    readJson(path.join(jobDir, benchmarkArtifactNames.observations)),
    readJson(path.join(jobDir, benchmarkArtifactNames.run)),
  ]);
  const definitionErrors = validateDefinition(definition);
  if (definitionErrors.length) throw new Error(`Invalid benchmark:\n${definitionErrors.map((error) => `- ${error}`).join("\n")}`);
  const targetIds = new Set(definition.targets.map((target) => target.id));
  const dimensionIds = new Set(definition.dimensions.map((dimension) => dimension.id));
  const issues = [];
  const valid = [];
  for (const id of duplicates((observationFile.observations ?? []).map((observation) => observation.id).filter(Boolean))) issues.push({ severity: "error", code: "duplicate-observation", observationId: id, message: `Duplicate observation id: ${id}` });
  for (const observation of observationFile.observations ?? []) {
    const result = validateObservation(observation, targetIds, dimensionIds, definition.maxEvidenceAgeDays, now);
    for (const message of result.errors) issues.push({ severity: "error", code: "invalid-observation", observationId: observation.id ?? null, message });
    if (!result.errors.length && observation.status === "observed") {
      if (!result.fresh) issues.push({ severity: "error", code: "stale-evidence", observationId: observation.id, message: `Observation ${observation.id} has no fresh evidence.` });
      else valid.push(observation);
    }
  }
  const targets = definition.targets.map((target) => {
    let ratedWeight = 0;
    let weightedScore = 0;
    const dimensions = {};
    for (const dimension of definition.dimensions) {
      const entries = valid.filter((observation) => observation.targetId === target.id && observation.dimensionId === dimension.id);
      const reviewers = new Set(entries.map((entry) => entry.reviewer));
      let score = null;
      if (reviewers.size >= definition.minimumReviewers) {
        score = Number((entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length).toFixed(2));
        ratedWeight += dimension.weight;
        weightedScore += score * dimension.weight;
      } else {
        issues.push({ severity: "warning", code: "insufficient-reviewers", targetId: target.id, dimensionId: dimension.id, message: `${target.label} / ${dimension.label} has ${reviewers.size} reviewer(s); ${definition.minimumReviewers} required before that dimension can be scored.` });
      }
      const spread = entries.length ? Math.max(...entries.map((entry) => entry.score)) - Math.min(...entries.map((entry) => entry.score)) : 0;
      if (spread >= 2) issues.push({ severity: "warning", code: "reviewer-disagreement", targetId: target.id, dimensionId: dimension.id, message: `${target.label} / ${dimension.label} reviewer scores differ by ${spread}; adjudication required.` });
      dimensions[dimension.id] = { score, reviewers: reviewers.size, observations: entries.map((entry) => entry.id), spread };
    }
    const totalWeight = definition.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    const coverage = Number((ratedWeight / totalWeight).toFixed(4));
    return { id: target.id, label: target.label, role: target.role, overall: ratedWeight ? Number((weightedScore / ratedWeight).toFixed(2)) : null, coverage, rankable: coverage >= definition.minimumEvidenceCoverage, dimensions };
  });
  const status = targets.every((target) => target.rankable) && !issues.some((entry) => entry.severity === "error") ? "ready" : "incomplete";
  const generatedAt = now.toISOString();
  const scorecard = { version: 1, benchmarkId: definition.id, generatedAt, status, rubric: { minimum: 0, maximum: 4 }, targets, issues };
  const experiments = buildExperiments(definition, scorecard);
  const experimentFile = { version: 1, benchmarkId: definition.id, generatedAt, experiments };
  const report = renderReport(definition, scorecard, experiments);
  const runs = Array.isArray(previousRun.runs) ? previousRun.runs : [];
  const run = { ...previousRun, status, updatedAt: generatedAt, runs: [...runs, { generatedAt, status, rankableTargets: targets.filter((target) => target.rankable).length, experiments: experiments.length }] };
  await writeJson(path.join(jobDir, benchmarkArtifactNames.scorecard), scorecard);
  await writeJson(path.join(jobDir, benchmarkArtifactNames.experiments), experimentFile);
  await writeFile(path.join(jobDir, benchmarkArtifactNames.report), report);
  await writeJson(path.join(jobDir, benchmarkArtifactNames.run), run);
  return { definition, scorecard, experiments: experimentFile, report, run };
}

export async function inspectBenchmarkJob(jobDir) {
  const run = await readJson(path.join(jobDir, benchmarkArtifactNames.run));
  let scorecard = null;
  try { scorecard = await readJson(path.join(jobDir, benchmarkArtifactNames.scorecard)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return { run, scorecard };
}
