import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { artifactNames, loadLessonGenerationSchema, stageSchemas } from "./contracts.mjs";
import { stagePrompts } from "./prompts.mjs";
import { buildSourcePack } from "./source-pack.mjs";
import { evaluateArtifacts, validateBrief } from "./validate.mjs";

const promptVersion = "2026-08-13.1";

function jsonHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

function assertShape(stage, artifact) {
  const arrays = {
    claims: ["claims", "gaps"],
    plan: ["misconceptions", "sections", "assessmentPlan"],
    interactions: ["interactions"],
    evaluation: ["issues"],
  };
  for (const field of arrays[stage] ?? []) if (!Array.isArray(artifact?.[field])) throw new Error(`Stage ${stage} returned invalid field: ${field}`);
  if (stage === "claims" && artifact.claims.some((claim) => !Array.isArray(claim.sourceIds))) throw new Error("Claims stage returned a claim without sourceIds.");
  if (stage === "plan" && artifact.sections.some((section) => !Array.isArray(section.claimIds))) throw new Error("Plan stage returned a section without claimIds.");
  if (stage === "interactions" && artifact.interactions.some((interaction) => !Array.isArray(interaction.variables) || !Array.isArray(interaction.evidenceClaimIds))) throw new Error("Interactions stage returned an invalid evidence or variable list.");
  if (stage === "lesson" && (!Array.isArray(artifact?.sections) || !Array.isArray(artifact?.sources))) throw new Error("Lesson stage returned an invalid lesson document.");
  if (stage === "evaluation" && (!artifact?.scores || !["pass", "revise"].includes(artifact?.verdict))) throw new Error("Evaluation stage returned an invalid review document.");
  if (stage === "evaluation" && Object.values(artifact.scores).some((score) => !Number.isInteger(score) || score < 1 || score > 5)) throw new Error("Evaluation scores must be integers from 1 to 5.");
}

async function stageArtifact({ runDir, filename, stage, provider, schema, input, force, manifest }) {
  const file = path.join(runDir, filename);
  if (!force) {
    try {
      const artifact = await readJson(file);
      assertShape(stage, artifact);
      manifest.stages[stage] = { status: "reused", artifact: filename };
      return artifact;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  manifest.stages[stage] = { status: "running", artifact: filename };
  const artifact = await provider.generate({ stage, schema, system: stagePrompts[stage], input });
  assertShape(stage, artifact);
  await writeJson(file, artifact);
  manifest.stages[stage] = { status: "complete", artifact: filename };
  return artifact;
}

function reviewMarkdown({ lesson, evaluation }) {
  const errorLines = evaluation.deterministic.errors.map((issue) => `- [ ] **${issue.code}:** ${issue.message}`);
  const warningLines = evaluation.deterministic.warnings.map((issue) => `- [ ] **${issue.code}:** ${issue.message}`);
  return `# Human review: ${lesson.title}

Automated status: **${evaluation.publishable ? "ready for human review" : "blocked"}**

## Required checks

- [ ] The core mental model is accurate and transferable.
- [ ] Every factual claim is supported by the cited source material.
- [ ] Illustrative values are unmistakably labeled.
- [ ] The simulator exposes a real relationship rather than decorative motion.
- [ ] Incorrect quiz answers diagnose plausible misconceptions.
- [ ] The exercise can be completed and checked in under 30 minutes.
- [ ] A keyboard-only and narrow-screen review has been completed.

## Automated errors

${errorLines.length ? errorLines.join("\n") : "None."}

## Automated warnings

${warningLines.length ? warningLines.join("\n") : "None."}

## Decision

- [ ] Approve for installation
- [ ] Return for revision

Reviewer:

Date:
`;
}

export async function runLessonPipeline({
  brief,
  runDir,
  provider,
  force = false,
  maxRepairs = 1,
  fetchImpl = fetch,
  clock = () => new Date(),
}) {
  const briefErrors = validateBrief(brief);
  if (briefErrors.length) throw new Error(`Invalid brief:\n${briefErrors.map((error) => `- ${error}`).join("\n")}`);
  await mkdir(runDir, { recursive: true });
  const manifest = {
    runId: brief.id,
    topic: brief.topic,
    status: "running",
    provider: provider.constructor.name,
    model: provider.model ?? "unknown",
    promptVersion,
    startedAt: clock().toISOString(),
    stages: {},
  };

  const manifestFile = path.join(runDir, artifactNames.manifest);
  try {
    if (!force) {
      try {
        const previousManifest = await readJson(manifestFile);
        const incompatible = previousManifest.promptVersion !== promptVersion
          || previousManifest.model !== manifest.model
          || previousManifest.provider !== manifest.provider;
        if (incompatible) throw new Error("The provider, model, or prompt version changed. Rerun with --force to regenerate the checkpointed artifacts.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      try {
        const previousBrief = await readJson(path.join(runDir, artifactNames.brief));
        if (jsonHash(previousBrief) !== jsonHash(brief)) throw new Error("The brief changed. Rerun with --force to prevent stale artifacts from being reused.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    await writeJson(path.join(runDir, artifactNames.brief), brief);
    manifest.stages.brief = { status: "complete", artifact: artifactNames.brief };

    let sourcePack;
    const sourceFile = path.join(runDir, artifactNames.sources);
    if (!force) {
      try {
        sourcePack = await readJson(sourceFile);
        manifest.stages.sources = { status: "reused", artifact: artifactNames.sources };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!sourcePack) {
      sourcePack = await buildSourcePack(brief, { fetchImpl, clock });
      await writeJson(sourceFile, sourcePack);
      manifest.stages.sources = { status: "complete", artifact: artifactNames.sources };
    }

    const claims = await stageArtifact({ runDir, filename: artifactNames.claims, stage: "claims", provider, schema: stageSchemas.claims, input: { brief, sourcePack }, force, manifest });
    const plan = await stageArtifact({ runDir, filename: artifactNames.plan, stage: "plan", provider, schema: stageSchemas.plan, input: { brief, claims }, force, manifest });
    const interactions = await stageArtifact({ runDir, filename: artifactNames.interactions, stage: "interactions", provider, schema: stageSchemas.interactions, input: { brief, claims, plan }, force, manifest });
    const lessonSchema = await loadLessonGenerationSchema();
    const lessonInput = { brief, sourcePack, claims, plan, interactions };
    let lesson = await stageArtifact({ runDir, filename: artifactNames.lesson, stage: "lesson", provider, schema: lessonSchema, input: lessonInput, force, manifest });

    let evaluation;
    const evaluationFile = path.join(runDir, artifactNames.evaluation);
    if (!force) {
      try {
        const previousEvaluation = await readJson(evaluationFile);
        assertShape("evaluation", previousEvaluation.modelReview);
        if (previousEvaluation.lessonSha256 === jsonHash(lesson)) {
          evaluation = previousEvaluation;
          manifest.stages.evaluation = { status: "reused", artifact: artifactNames.evaluation, repairAttempts: evaluation.repairAttempts };
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!evaluation) {
      let attempts = 0;
      let deterministic;
      let modelReview;
      while (true) {
        deterministic = evaluateArtifacts({ sourcePack, claims, plan, interactions, lesson });
        modelReview = await provider.generate({ stage: "evaluation", schema: stageSchemas.evaluation, system: stagePrompts.evaluation, input: { brief, sourcePack, claims, plan, interactions, lesson, deterministic } });
        assertShape("evaluation", modelReview);
        const blocked = deterministic.errors.length > 0 || modelReview.verdict !== "pass" || Object.values(modelReview.scores).some((score) => score < 3);
        if (!blocked || attempts >= maxRepairs) break;
        attempts += 1;
        lesson = await provider.generate({ stage: `repair_${attempts}`, schema: lessonSchema, system: stagePrompts.repair, input: { ...lessonInput, lesson, deterministic, modelReview } });
        assertShape("lesson", lesson);
        await writeJson(path.join(runDir, artifactNames.lesson), lesson);
      }
      evaluation = {
        evaluatedAt: clock().toISOString(),
        lessonSha256: jsonHash(lesson),
        repairAttempts: attempts,
        publishable: deterministic.errors.length === 0 && modelReview.verdict === "pass" && Object.values(modelReview.scores).every((score) => score >= 3),
        deterministic: { errors: deterministic.errors, warnings: deterministic.warnings },
        modelReview,
      };
      await writeJson(evaluationFile, evaluation);
      manifest.stages.evaluation = { status: evaluation.publishable ? "complete" : "blocked", artifact: artifactNames.evaluation, repairAttempts: attempts };
    }
    const reviewFile = path.join(runDir, artifactNames.review);
    let reviewStatus = "pending-human";
    if (!force) {
      try {
        const existingReview = await readFile(reviewFile, "utf8");
        reviewStatus = /- \[[xX]\] Approve for installation/.test(existingReview) ? "approved" : "pending-human";
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await writeFile(reviewFile, reviewMarkdown({ lesson, evaluation }));
      }
    } else {
      await writeFile(reviewFile, reviewMarkdown({ lesson, evaluation }));
    }
    manifest.stages.review = { status: reviewStatus, artifact: artifactNames.review };
    manifest.status = evaluation.publishable ? (reviewStatus === "approved" ? "approved" : "awaiting-human-review") : "blocked";
    manifest.finishedAt = clock().toISOString();
    await writeJson(manifestFile, manifest);
    return { manifest, sourcePack, claims, plan, interactions, lesson, evaluation };
  } catch (error) {
    manifest.status = "failed";
    manifest.finishedAt = clock().toISOString();
    manifest.failure = { name: error.name, message: error.message };
    await writeJson(manifestFile, manifest);
    throw error;
  }
}
