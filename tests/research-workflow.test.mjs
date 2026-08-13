import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { auditResearchJob, createResearchJob, importChatGPTExport, packageResearchBook, researchArtifactNames } from "../harness/research.mjs";

const fixedClock = () => new Date("2026-08-13T18:00:00.000Z");
const lesson = JSON.parse(await readFile(new URL("../content/harness-control-loop.json", import.meta.url), "utf8"));

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function createJob(prefix = "learning-research-") {
  const jobDir = await mkdtemp(path.join(tmpdir(), prefix));
  await createResearchJob({
    jobDir,
    id: "feedback-systems",
    topic: "Feedback systems",
    audience: "software engineers",
    outcome: "Design a reliable feedback loop",
    clock: fixedClock,
  });
  return jobDir;
}

test("research start creates durable empty artifacts without model access", async () => {
  const jobDir = await createJob();
  for (const filename of Object.values(researchArtifactNames).filter((name) => name !== researchArtifactNames.book)) {
    const value = JSON.parse(await readFile(path.join(jobDir, filename), "utf8"));
    assert.ok(value);
  }
  const { gapReport } = await auditResearchJob({ jobDir, clock: fixedClock });
  assert.equal(gapReport.status, "expand");
  assert.ok(gapReport.issues.some((entry) => entry.code === "no-concepts"));
});

test("research audit passes only grounded, diverse, located core evidence", async () => {
  const jobDir = await createJob("learning-research-ready-");
  await populateReadyResearch(jobDir);
  const { gapReport } = await auditResearchJob({ jobDir, clock: fixedClock });
  assert.equal(gapReport.status, "ready");
  assert.equal(gapReport.metrics.conceptCoverage, 1);
  assert.equal(gapReport.metrics.criticalContradictions, 0);
  assert.deepEqual(gapReport.issues, []);
});

test("learner conversations personalize but do not corroborate core claims", async () => {
  const jobDir = await createJob("learning-research-learner-");
  await populateReadyResearch(jobDir);
  const sourceFile = path.join(jobDir, researchArtifactNames.sources);
  const catalog = JSON.parse(await readFile(sourceFile, "utf8"));
  catalog.sources[1].type = "conversation";
  catalog.sources[1].authority = "learner";
  await writeJson(sourceFile, catalog);
  const { gapReport } = await auditResearchJob({ jobDir, clock: fixedClock });
  assert.equal(gapReport.status, "expand");
  assert.ok(gapReport.issues.some((entry) => entry.code === "insufficient-source-diversity"));
});

test("ChatGPT export import keeps only user messages as local learner notes", async () => {
  const jobDir = await createJob("learning-research-chat-import-");
  const exportFile = path.join(jobDir, "conversations.json");
  await writeJson(exportFile, [{
    id: "conversation-1",
    title: "What I know about feedback",
    create_time: 1_700_000_000,
    update_time: 1_700_000_100,
    mapping: {
      user: { message: { author: { role: "user" }, create_time: 1_700_000_000, content: { parts: ["I understand tests, but observability is confusing."] } } },
      assistant: { message: { author: { role: "assistant" }, create_time: 1_700_000_001, content: { parts: ["This assistant answer must not be imported as evidence."] } } },
    },
  }]);
  const result = await importChatGPTExport({ jobDir, exportFile, clock: fixedClock });
  assert.equal(result.imported, 1);
  const catalog = JSON.parse(await readFile(path.join(jobDir, researchArtifactNames.sources), "utf8"));
  assert.equal(catalog.sources[0].authority, "learner");
  const note = await readFile(path.join(jobDir, catalog.sources[0].noteFile), "utf8");
  assert.match(note, /observability is confusing/);
  assert.doesNotMatch(note, /assistant answer/);
  const second = await importChatGPTExport({ jobDir, exportFile, clock: fixedClock });
  assert.equal(second.imported, 0);
});

test("research package freezes an evidence hash and validates every chapter", async () => {
  const jobDir = await createJob("learning-research-package-");
  await populateReadyResearch(jobDir);
  await writeJson(path.join(jobDir, researchArtifactNames.curriculum), {
    title: "Feedback Systems",
    summary: "A source-grounded course on observable feedback and recovery in software systems.",
    chapters: [{
      id: "chapter-01",
      title: "The control loop",
      objective: "Explain and diagnose a complete feedback loop",
      conceptIds: ["feedback-loop"],
      evidenceClaimIds: ["claim-1"],
      prerequisiteChapterIds: [],
      lessonFile: "chapters/chapter-01.json",
    }],
  });
  await writeJson(path.join(jobDir, "chapters/chapter-01.json"), lesson);
  await auditResearchJob({ jobDir, clock: fixedClock });
  await auditResearchJob({ jobDir, clock: fixedClock });
  const book = await packageResearchBook({ jobDir, clock: fixedClock });
  assert.equal(book.chapters.length, 1);
  assert.equal(book.sources.length, 3);
  assert.match(book.evidencePackSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(book, JSON.parse(await readFile(path.join(jobDir, researchArtifactNames.book), "utf8")));
});

async function populateReadyResearch(jobDir) {
  await writeJson(path.join(jobDir, researchArtifactNames.queries), { round: 1, queries: [] });
  await writeJson(path.join(jobDir, researchArtifactNames.concepts), {
    concepts: [{ id: "feedback-loop", label: "Feedback loop", importance: "core", prerequisiteIds: [], objective: "Explain how observations change subsequent action." }],
  });
  await writeJson(path.join(jobDir, researchArtifactNames.sources), {
    sources: lesson.sources.map((source, index) => ({
      id: `source-${index + 1}`,
      type: "web",
      title: source.label,
      url: source.url,
      authority: index === 0 ? "primary" : "secondary",
      independenceGroup: `publisher-${index + 1}`,
      retrievedAt: fixedClock().toISOString(),
    })),
  });
  await writeJson(path.join(jobDir, researchArtifactNames.evidence), {
    claims: [{
      id: "claim-1",
      conceptId: "feedback-loop",
      claim: "Reliable agent work depends on observable feedback and durable state.",
      status: "supported",
      sourceIds: ["source-1", "source-2"],
      locators: [
        { sourceId: "source-1", heading: "Harness engineering" },
        { sourceId: "source-2", heading: "Long-running agents" },
      ],
    }],
  });
}
