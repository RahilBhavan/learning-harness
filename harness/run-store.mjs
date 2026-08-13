import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { artifactNames } from "./contracts.mjs";

export function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

export async function inspectRun(runDir) {
  const manifest = await readJson(path.join(runDir, artifactNames.manifest));
  let lesson = null;
  let evaluation = null;
  let approval = null;
  try { lesson = await readJson(path.join(runDir, artifactNames.lesson)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  try { evaluation = await readJson(path.join(runDir, artifactNames.evaluation)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  try { approval = await readJson(path.join(runDir, artifactNames.approval)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const approvalValid = Boolean(approval && lesson && evaluation
    && approval.lessonSha256 === hashJson(lesson)
    && approval.lessonSha256 === evaluation.lessonSha256
    && approval.evaluationSha256 === hashJson(evaluation));
  return { manifest, lesson, evaluation, approval, approvalValid };
}

export async function approveRun({ runDir, reviewer, note = "", clock = () => new Date() }) {
  if (!reviewer?.trim()) throw new Error("A reviewer name is required.");
  const lesson = await readJson(path.join(runDir, artifactNames.lesson));
  const evaluation = await readJson(path.join(runDir, artifactNames.evaluation));
  const lessonSha256 = hashJson(lesson);
  if (!evaluation.publishable) throw new Error("Automated quality gates are blocked; this run cannot be approved.");
  if (evaluation.lessonSha256 !== lessonSha256) throw new Error("The lesson changed after evaluation. Regenerate or reevaluate it before approval.");
  const approval = {
    version: 1,
    runId: (await readJson(path.join(runDir, artifactNames.manifest))).runId,
    reviewer: reviewer.trim(),
    approvedAt: clock().toISOString(),
    lessonSha256,
    evaluationSha256: hashJson(evaluation),
    checklist: ["accuracy", "citations", "illustrative-labels", "interaction-integrity", "assessment-quality", "accessibility"],
    note: note.trim(),
  };
  await writeJsonAtomic(path.join(runDir, artifactNames.approval), approval);
  return approval;
}

export async function installRun({ runDir, target, force = false }) {
  const { evaluation, approval, approvalValid } = await inspectRun(runDir);
  if (!evaluation?.publishable) throw new Error("Automated quality gates are blocked; this run cannot be installed.");
  if (!approval || !approvalValid) throw new Error("A valid approval for this exact lesson and evaluation is required before installation.");
  await copyFile(path.join(runDir, artifactNames.lesson), target, force ? 0 : constants.COPYFILE_EXCL);
  return { target, approval };
}
