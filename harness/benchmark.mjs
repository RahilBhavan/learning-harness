import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const benchmarkArtifactNames = {
  definition: "00-benchmark.json",
  observations: "01-observations.json",
  scorecard: "02-scorecard.json",
  experiments: "03-experiments.json",
  report: "04-report.md",
  implementationResearch: "05-implementation-research.json",
  implementationPlan: "06-implementation-plan.md",
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
  await writeJson(path.join(jobDir, benchmarkArtifactNames.implementationResearch), { version: 1, benchmarkId: definition.id, studies: [] });
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

const researchScoreKeys = ["fit", "delivery", "maintainability", "accessibility", "portability"];

function validateResearchEvidence(evidence, maxAgeDays, now) {
  const errors = [];
  if (!evidence?.locator?.trim() || (!evidence.url && !evidence.path)) errors.push("evidence needs url or path plus a locator");
  if (evidence?.url) {
    try { if (!["http:", "https:"].includes(new URL(evidence.url).protocol)) throw new Error(); } catch { errors.push(`invalid evidence URL: ${evidence.url}`); }
  }
  if (!evidenceIsFresh({ capturedAt: evidence?.accessedAt }, maxAgeDays, now)) errors.push("evidence is missing a fresh accessedAt timestamp");
  return errors;
}

function validateStudy(study, experiment, maxAgeDays, now) {
  const errors = [];
  if (!study?.owner?.trim()) errors.push("owner is required");
  if (!Array.isArray(study?.constraints) || !study.constraints.length) errors.push("at least one implementation constraint is required");
  if (!Array.isArray(study?.candidates) || study.candidates.length < 2) errors.push("at least two implementation candidates are required");
  const candidateIds = new Set();
  for (const candidate of study?.candidates ?? []) {
    if (!candidate?.id?.trim() || !candidate?.name?.trim() || !candidate?.summary?.trim()) errors.push("each candidate needs id, name, and summary");
    if (candidateIds.has(candidate.id)) errors.push(`duplicate candidate id: ${candidate.id}`);
    candidateIds.add(candidate.id);
    for (const key of researchScoreKeys) if (!Number.isInteger(candidate?.scores?.[key]) || candidate.scores[key] < 1 || candidate.scores[key] > 5) errors.push(`${candidate.id ?? "candidate"} ${key} score must be an integer from 1 to 5`);
    if (!Array.isArray(candidate?.evidence) || !candidate.evidence.length) errors.push(`${candidate.id ?? "candidate"} needs primary-source or repository evidence`);
    for (const evidence of candidate?.evidence ?? []) for (const error of validateResearchEvidence(evidence, maxAgeDays, now)) errors.push(`${candidate.id ?? "candidate"}: ${error}`);
  }
  if (!candidateIds.has(study?.recommendation?.candidateId)) errors.push("recommendation must select a candidate from this study");
  if (!study?.recommendation?.rationale?.trim()) errors.push("recommendation rationale is required");
  if (study?.recommendation?.confidence !== "conditional") errors.push("recommendation confidence must remain conditional until the spike passes");
  if (!study?.spike?.question?.trim() || !Array.isArray(study?.spike?.steps) || !study.spike.steps.length || !Array.isArray(study?.spike?.passCriteria) || !study.spike.passCriteria.length) errors.push("spike needs a question, steps, and pass criteria");
  if (!["planned", "passed", "failed"].includes(study?.spike?.status)) errors.push("spike status must be planned, passed, or failed");
  if (study?.spike?.status !== "planned" && (!Array.isArray(study.spike.results) || !study.spike.results.length)) errors.push("completed spikes require measured results");
  for (const acceptance of experiment.acceptance) if (!study?.spike?.passCriteria?.includes(acceptance)) errors.push(`spike must preserve benchmark acceptance: ${acceptance}`);
  return errors;
}

function scoreCandidate(candidate) {
  if (researchScoreKeys.some((key) => !Number.isInteger(candidate?.scores?.[key]))) return Number.NaN;
  return Number((researchScoreKeys.reduce((sum, key) => sum + candidate.scores[key], 0) / researchScoreKeys.length).toFixed(2));
}

function renderImplementationPlan(definition, experiments, studies, audit) {
  const targets = new Map(definition.targets.map((target) => [target.id, target.label]));
  const dimensions = new Map(definition.dimensions.map((dimension) => [dimension.id, dimension.label]));
  const sections = experiments.map((experiment, index) => {
    const study = studies.find((entry) => entry.experimentId === experiment.id);
    if (!study) return `## ${index + 1}. ${dimensions.get(experiment.dimensionId)}\n\nResearch is incomplete: no implementation study is linked to \`${experiment.id}\`.`;
    const ranked = (study.candidates ?? []).map((candidate) => ({ ...candidate, total: scoreCandidate(candidate) })).sort((left, right) => (right.total ?? -1) - (left.total ?? -1));
    const selected = ranked.find((candidate) => candidate.id === study.recommendation?.candidateId);
    const table = ranked.map((candidate) => `| ${candidate.name ?? "invalid candidate"} | ${candidate.scores?.fit ?? "?"} | ${candidate.scores?.delivery ?? "?"} | ${candidate.scores?.maintainability ?? "?"} | ${candidate.scores?.accessibility ?? "?"} | ${candidate.scores?.portability ?? "?"} | ${Number.isFinite(candidate.total) ? candidate.total.toFixed(2) : "?"} |`).join("\n");
    const recommendation = study.recommendation ?? {};
    const spike = study.spike ?? {};
    return `## ${index + 1}. ${dimensions.get(experiment.dimensionId)}\n\nBenchmark: **${targets.get(experiment.benchmarkTargetId)}** · gap ${experiment.gap.toFixed(2)} · priority ${experiment.priority}\n\nOwner: ${study.owner ?? "not assigned"}\n\n### Candidate comparison\n\n| Candidate | Fit | Delivery | Maintainability | Accessibility | Portability | Mean |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${table}\n\nConditional recommendation: **${selected?.name ?? recommendation.candidateId ?? "not selected"}**. ${recommendation.rationale ?? "No rationale supplied."}\n\nConstraints:\n${(study.constraints ?? []).map((item) => `- ${item}`).join("\n")}\n\n### Real-data spike\n\nQuestion: ${spike.question ?? "Not defined."}\n\nSteps:\n${(spike.steps ?? []).map((item) => `- [ ] ${item}`).join("\n")}\n\nPass criteria:\n${(spike.passCriteria ?? []).map((item) => `- [ ] ${item}`).join("\n")}\n\nCompetitor rerun: ${experiment.rerun}`;
  });
  const issueLines = audit.issues.length ? audit.issues.map((issue) => `- **${issue.severity}: ${issue.code}** — ${issue.message}`).join("\n") : "None.";
  return `# ${definition.title}: implementation research plan\n\nGenerated: ${audit.generatedAt}\n\nStatus: **${audit.status}**\n\nRecommendations are conditional until their real-data spike passes. Candidate means are decision aids, not substitutes for the documented constraints, evidence, or acceptance checks.\n\n## Research integrity\n\n${issueLines}\n\n${sections.join("\n\n")}\n`;
}

export async function auditImplementationResearch({ jobDir, clock = () => new Date() }) {
  const now = clock();
  const [definition, experimentFile, researchFile, previousRun] = await Promise.all([
    readJson(path.join(jobDir, benchmarkArtifactNames.definition)),
    readJson(path.join(jobDir, benchmarkArtifactNames.experiments)),
    readJson(path.join(jobDir, benchmarkArtifactNames.implementationResearch)),
    readJson(path.join(jobDir, benchmarkArtifactNames.run)),
  ]);
  const experiments = experimentFile.experiments ?? [];
  const studies = researchFile.studies ?? [];
  const issues = [];
  for (const id of duplicates(studies.map((study) => study.experimentId).filter(Boolean))) issues.push({ severity: "error", code: "duplicate-study", experimentId: id, message: `Duplicate implementation study for ${id}.` });
  for (const experiment of experiments) {
    const study = studies.find((entry) => entry.experimentId === experiment.id);
    if (!study) {
      issues.push({ severity: "error", code: "missing-study", experimentId: experiment.id, message: `No implementation research exists for ${experiment.id}.` });
      continue;
    }
    for (const message of validateStudy(study, experiment, definition.maxEvidenceAgeDays, now)) issues.push({ severity: "error", code: "invalid-study", experimentId: experiment.id, message });
  }
  for (const study of studies.filter((entry) => !experiments.some((experiment) => experiment.id === entry.experimentId))) issues.push({ severity: "warning", code: "orphan-study", experimentId: study.experimentId ?? null, message: `Study ${study.experimentId ?? "unknown"} does not match a current benchmark experiment.` });
  const generatedAt = now.toISOString();
  const status = !issues.some((issue) => issue.severity === "error") && experiments.length > 0 ? "ready-for-spike" : "incomplete";
  const decisions = experiments.map((experiment) => {
    const study = studies.find((entry) => entry.experimentId === experiment.id);
    return { experimentId: experiment.id, candidateId: study?.recommendation?.candidateId ?? null, spikeStatus: study?.spike?.status ?? null, candidates: (study?.candidates ?? []).map((candidate) => ({ id: candidate.id, score: scoreCandidate(candidate) })) };
  });
  const audit = { version: 1, benchmarkId: definition.id, generatedAt, status, decisions, issues };
  const plan = renderImplementationPlan(definition, experiments, studies, audit);
  const researchRuns = Array.isArray(previousRun.researchRuns) ? previousRun.researchRuns : [];
  const run = { ...previousRun, updatedAt: generatedAt, researchStatus: status, researchRuns: [...researchRuns, { generatedAt, status, decisions: decisions.length }] };
  await writeJson(path.join(jobDir, benchmarkArtifactNames.implementationResearch), { ...researchFile, auditedAt: generatedAt });
  await writeFile(path.join(jobDir, benchmarkArtifactNames.implementationPlan), plan);
  await writeJson(path.join(jobDir, benchmarkArtifactNames.run), run);
  return { definition, experiments: experimentFile, research: researchFile, audit, plan, run };
}
