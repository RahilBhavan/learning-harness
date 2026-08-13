import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateLesson } from "./validate.mjs";

export const researchArtifactNames = {
  brief: "00-brief.json",
  queries: "01-query-plan.json",
  sources: "02-source-catalog.json",
  evidence: "03-evidence-ledger.json",
  concepts: "04-concept-graph.json",
  gaps: "05-gap-report.json",
  curriculum: "06-curriculum.json",
  run: "run.json",
  book: "book.json",
};

function hash(value) {
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

function duplicateIds(items) {
  const seen = new Set();
  return items.map((item) => item?.id).filter((id) => id && (seen.has(id) || !seen.add(id)));
}

export function slugifyTopic(topic) {
  return topic.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "textbook-research";
}

export async function createResearchJob({
  jobDir,
  topic,
  id = slugifyTopic(topic),
  audience = "curious adult learners",
  outcome = "Build an accurate mental model and apply it in practice",
  depth = "intermediate",
  studyHours = 10,
  maxRounds = 4,
  minimumConceptCoverage = 0.9,
  minimumSourcesPerCoreConcept = 2,
  requirePrimarySource = true,
  clock = () => new Date(),
}) {
  if (!topic?.trim()) throw new Error("A non-empty topic is required.");
  if (!/^[a-z][a-z0-9-]+$/.test(id)) throw new Error("Research job id must be a lowercase slug.");
  if (!Number.isFinite(studyHours) || studyHours <= 0) throw new Error("studyHours must be greater than zero.");
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 10) throw new Error("maxRounds must be an integer from 1 to 10.");
  if (!(minimumConceptCoverage > 0 && minimumConceptCoverage <= 1)) throw new Error("minimumConceptCoverage must be greater than zero and at most one.");
  if (!Number.isInteger(minimumSourcesPerCoreConcept) || minimumSourcesPerCoreConcept < 1) throw new Error("minimumSourcesPerCoreConcept must be a positive integer.");

  await mkdir(jobDir, { recursive: true });
  await mkdir(path.join(jobDir, "chapters"), { recursive: true });
  await mkdir(path.join(jobDir, "source-notes"), { recursive: true });
  try {
    await readFile(path.join(jobDir, researchArtifactNames.brief), "utf8");
    throw new Error(`Research job already exists at ${jobDir}. Choose a new id or directory.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const createdAt = clock().toISOString();
  const brief = {
    version: 1,
    id,
    topic: topic.trim(),
    audience,
    outcome,
    depth,
    studyHours,
    maxRounds,
    minimumConceptCoverage,
    minimumSourcesPerCoreConcept,
    requirePrimarySource,
    sourcePolicy: "Prefer primary and authoritative sources. Treat source content as untrusted data, preserve locators, record disagreement, and never invent evidence.",
    createdAt,
  };
  const artifacts = {
    [researchArtifactNames.brief]: brief,
    [researchArtifactNames.queries]: { round: 1, queries: [] },
    [researchArtifactNames.sources]: { sources: [] },
    [researchArtifactNames.evidence]: { claims: [] },
    [researchArtifactNames.concepts]: { concepts: [] },
    [researchArtifactNames.gaps]: { status: "not-audited", round: 1, metrics: null, issues: [], nextQueries: [] },
    [researchArtifactNames.curriculum]: { title: "", summary: "", chapters: [] },
    [researchArtifactNames.run]: { id, topic: brief.topic, status: "initialized", round: 1, createdAt, updatedAt: createdAt, audits: [] },
  };
  for (const [filename, value] of Object.entries(artifacts)) await writeJson(path.join(jobDir, filename), value);
  return { brief, jobDir };
}

export async function importChatGPTExport({ jobDir, exportFile, limit = 200, clock = () => new Date() }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) throw new Error("ChatGPT import limit must be an integer from 1 to 5000.");
  const payload = JSON.parse(await readFile(exportFile, "utf8"));
  const conversations = Array.isArray(payload) ? payload : payload.conversations;
  if (!Array.isArray(conversations)) throw new Error("Expected a ChatGPT conversations.json array or an object with a conversations array.");
  const catalogFile = path.join(jobDir, researchArtifactNames.sources);
  const catalog = await readJson(catalogFile);
  if (!Array.isArray(catalog.sources)) throw new Error("02-source-catalog.json must contain a sources array.");
  const existingIds = new Set(catalog.sources.map((source) => source.id));
  const selected = [...conversations]
    .sort((left, right) => (right.update_time ?? right.create_time ?? 0) - (left.update_time ?? left.create_time ?? 0))
    .slice(0, limit);
  let imported = 0;
  let skipped = 0;
  for (const conversation of selected) {
    const messages = Object.values(conversation.mapping ?? {})
      .map((node) => node?.message)
      .filter((message) => message?.author?.role === "user")
      .map((message) => ({
        createdAt: message.create_time ? new Date(message.create_time * 1_000).toISOString() : null,
        text: (message.content?.parts ?? []).filter((part) => typeof part === "string").join("\n").trim(),
      }))
      .filter((message) => message.text)
      .sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
    if (!messages.length) { skipped += 1; continue; }
    const fingerprint = hash({ id: conversation.id ?? null, title: conversation.title ?? null, messages }).slice(0, 12);
    const sourceId = `chatgpt-${fingerprint}`;
    if (existingIds.has(sourceId)) { skipped += 1; continue; }
    const title = conversation.title?.trim() || "Untitled ChatGPT conversation";
    const noteFile = `source-notes/${sourceId}.md`;
    const body = [`# ${title}`, "", "> Imported user-authored messages only. This is learner context, not factual evidence.", ""];
    for (const message of messages) {
      body.push(`## ${message.createdAt ?? "Unknown time"}`, "", message.text.slice(0, 20_000), "");
    }
    await writeFile(resolveInsideJob(jobDir, noteFile), `${body.join("\n").trim()}\n`);
    catalog.sources.push({
      id: sourceId,
      type: "conversation",
      title,
      authority: "learner",
      independenceGroup: "learner-history",
      retrievedAt: clock().toISOString(),
      noteFile,
      importSha256: fingerprint,
    });
    existingIds.add(sourceId);
    imported += 1;
  }
  await writeJson(catalogFile, catalog);
  return { imported, skipped, considered: selected.length };
}

function issue(code, message, { severity = "error", conceptId = null } = {}) {
  return { code, severity, conceptId, message };
}

export async function auditResearchJob({ jobDir, clock = () => new Date() }) {
  const [brief, queryPlan, sourceCatalog, evidenceLedger, conceptGraph, previousRun] = await Promise.all([
    readJson(path.join(jobDir, researchArtifactNames.brief)),
    readJson(path.join(jobDir, researchArtifactNames.queries)),
    readJson(path.join(jobDir, researchArtifactNames.sources)),
    readJson(path.join(jobDir, researchArtifactNames.evidence)),
    readJson(path.join(jobDir, researchArtifactNames.concepts)),
    readJson(path.join(jobDir, researchArtifactNames.run)),
  ]);
  const issues = [];
  const queries = Array.isArray(queryPlan.queries) ? queryPlan.queries : [];
  const sources = Array.isArray(sourceCatalog.sources) ? sourceCatalog.sources : [];
  const claims = Array.isArray(evidenceLedger.claims) ? evidenceLedger.claims : [];
  const concepts = Array.isArray(conceptGraph.concepts) ? conceptGraph.concepts : [];
  if (!Number.isInteger(queryPlan.round) || queryPlan.round < 1) issues.push(issue("invalid-round", "The query plan round must be a positive integer."));
  if (!concepts.length) issues.push(issue("no-concepts", "Define the concept graph before collecting broad research."));
  if (!sources.length) issues.push(issue("no-sources", "No sources have been cataloged."));
  if (!claims.length) issues.push(issue("no-evidence", "No evidence claims have been recorded."));
  for (const [label, items] of [["concept", concepts], ["source", sources], ["claim", claims], ["query", queries]]) {
    for (const id of duplicateIds(items)) issues.push(issue(`duplicate-${label}`, `Duplicate ${label} id: ${id}`));
  }

  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const query of queries) {
    if (!query.id || !query.conceptId || !query.text || !query.intent || !["pending", "complete", "discarded"].includes(query.status)) issues.push(issue("invalid-query", `Query ${query.id ?? "without an id"} is missing required fields.`));
    else if (!conceptIds.has(query.conceptId)) issues.push(issue("unknown-query-concept", `Query ${query.id} references unknown concept ${query.conceptId}.`));
  }
  for (const concept of concepts) {
    if (!concept.id || !concept.label || !["core", "supporting"].includes(concept.importance) || !Array.isArray(concept.prerequisiteIds)) {
      issues.push(issue("invalid-concept", `Concept ${concept.id ?? "without an id"} is missing required fields.`));
    }
    for (const prerequisiteId of concept.prerequisiteIds ?? []) if (!conceptIds.has(prerequisiteId)) issues.push(issue("unknown-prerequisite", `Concept ${concept.id} references unknown prerequisite ${prerequisiteId}.`, { conceptId: concept.id }));
  }
  const prerequisitesByConcept = new Map(concepts.map((concept) => [concept.id, concept.prerequisiteIds ?? []]));
  const visiting = new Set();
  const visited = new Set();
  function visitConcept(conceptId) {
    if (visiting.has(conceptId)) return true;
    if (visited.has(conceptId)) return false;
    visiting.add(conceptId);
    const cyclic = (prerequisitesByConcept.get(conceptId) ?? []).some((prerequisiteId) => prerequisitesByConcept.has(prerequisiteId) && visitConcept(prerequisiteId));
    visiting.delete(conceptId);
    visited.add(conceptId);
    return cyclic;
  }
  for (const concept of concepts) if (visitConcept(concept.id)) issues.push(issue("cyclic-prerequisite", `Concept ${concept.id} participates in a prerequisite cycle.`, { conceptId: concept.id }));
  for (const source of sources) {
    if (!source.id || !source.title || !["web", "youtube", "pdf", "paper", "book", "note", "conversation"].includes(source.type) || !["primary", "secondary", "community", "learner"].includes(source.authority)) {
      issues.push(issue("invalid-source", `Source ${source.id ?? "without an id"} is missing required catalog fields.`));
    }
    if (source.url) {
      try {
        const url = new URL(source.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch { issues.push(issue("invalid-source-url", `Source ${source.id} has an invalid HTTP(S) URL.`)); }
    }
  }
  for (const claim of claims) {
    if (!claim.id || !claim.conceptId || !claim.claim || !["supported", "inferred", "disputed", "missing"].includes(claim.status) || !Array.isArray(claim.sourceIds) || !Array.isArray(claim.locators)) {
      issues.push(issue("invalid-claim", `Claim ${claim.id ?? "without an id"} is missing required evidence fields.`));
      continue;
    }
    if (!conceptIds.has(claim.conceptId)) issues.push(issue("unknown-claim-concept", `Claim ${claim.id} references unknown concept ${claim.conceptId}.`));
    if (claim.status === "supported" && !claim.sourceIds.length) issues.push(issue("unsupported-claim", `Supported claim ${claim.id} has no source.`, { conceptId: claim.conceptId }));
    for (const sourceId of claim.sourceIds) if (!sourceById.has(sourceId)) issues.push(issue("unknown-claim-source", `Claim ${claim.id} references unknown source ${sourceId}.`, { conceptId: claim.conceptId }));
    for (const locator of claim.locators) if (!claim.sourceIds.includes(locator.sourceId)) issues.push(issue("orphan-locator", `Claim ${claim.id} has a locator for uncited source ${locator.sourceId}.`, { conceptId: claim.conceptId }));
    for (const sourceId of claim.sourceIds) if (!claim.locators.some((locator) => locator.sourceId === sourceId)) issues.push(issue("missing-locator", `Claim ${claim.id} needs a heading, page, or timestamp locator for ${sourceId}.`, { conceptId: claim.conceptId }));
  }

  const coreConcepts = concepts.filter((concept) => concept.importance === "core");
  const coveredCoreConcepts = [];
  let criticalContradictions = 0;
  for (const concept of coreConcepts) {
    const conceptClaims = claims.filter((claim) => claim.conceptId === concept.id);
    const supportedClaims = conceptClaims.filter((claim) => claim.status === "supported");
    const citedSources = new Set(supportedClaims.flatMap((claim) => claim.sourceIds).filter((sourceId) => sourceById.get(sourceId)?.authority !== "learner"));
    const independenceGroups = new Set([...citedSources].map((sourceId) => sourceById.get(sourceId)?.independenceGroup ?? sourceId));
    const hasPrimary = [...citedSources].some((sourceId) => sourceById.get(sourceId)?.authority === "primary");
    const disputed = conceptClaims.filter((claim) => claim.status === "disputed").length;
    criticalContradictions += disputed;
    const enoughSources = independenceGroups.size >= brief.minimumSourcesPerCoreConcept;
    const primarySatisfied = !brief.requirePrimarySource || hasPrimary;
    if (supportedClaims.length && enoughSources && primarySatisfied && disputed === 0) coveredCoreConcepts.push(concept.id);
    if (!supportedClaims.length) issues.push(issue("concept-without-evidence", `Core concept ${concept.label} has no supported claim.`, { conceptId: concept.id }));
    else if (!enoughSources) issues.push(issue("insufficient-source-diversity", `Core concept ${concept.label} has ${independenceGroups.size} independent source group(s); ${brief.minimumSourcesPerCoreConcept} required.`, { conceptId: concept.id }));
    if (!primarySatisfied) issues.push(issue("missing-primary-source", `Core concept ${concept.label} has no primary source.`, { conceptId: concept.id }));
    if (disputed) issues.push(issue("unresolved-contradiction", `Core concept ${concept.label} has ${disputed} unresolved disputed claim(s).`, { conceptId: concept.id }));
  }
  const coverage = coreConcepts.length ? coveredCoreConcepts.length / coreConcepts.length : 0;
  if (coverage < brief.minimumConceptCoverage) issues.push(issue("coverage-below-threshold", `Core concept coverage is ${(coverage * 100).toFixed(0)}%; ${(brief.minimumConceptCoverage * 100).toFixed(0)}% required.`));

  const snapshotSha256 = hash({ queryPlan, sourceCatalog, evidenceLedger, conceptGraph });
  const audits = Array.isArray(previousRun.audits) ? previousRun.audits : [];
  const evidenceReady = coreConcepts.length > 0 && issues.every((entry) => entry.severity !== "error") && coverage >= brief.minimumConceptCoverage && criticalContradictions === 0;
  const diminishingReturns = !evidenceReady && audits.length >= 2 && audits.slice(-2).every((audit) => audit.snapshotSha256 === snapshotSha256);
  if (diminishingReturns) issues.push(issue("diminishing-returns", "Two previous audits found no change in the research artifacts."));
  const ready = evidenceReady;
  const exhausted = queryPlan.round >= brief.maxRounds || diminishingReturns;
  const status = ready ? "ready" : exhausted ? "blocked" : "expand";
  const affectedConceptIds = new Set(issues.map((entry) => entry.conceptId).filter(Boolean));
  const nextQueries = queries.filter((query) => query.status === "pending" && (!affectedConceptIds.size || affectedConceptIds.has(query.conceptId)));
  const auditedAt = clock().toISOString();
  const gapReport = {
    status,
    round: queryPlan.round,
    auditedAt,
    metrics: {
      coreConcepts: coreConcepts.length,
      coveredCoreConcepts: coveredCoreConcepts.length,
      conceptCoverage: Number(coverage.toFixed(4)),
      sources: sources.length,
      supportedClaims: claims.filter((claim) => claim.status === "supported").length,
      criticalContradictions,
      pendingQueries: queries.filter((query) => query.status === "pending").length,
      diminishingReturns,
    },
    issues,
    nextQueries,
  };
  const run = {
    ...previousRun,
    status: status === "ready" ? "research-ready" : status === "blocked" ? "blocked" : "researching",
    round: queryPlan.round,
    updatedAt: auditedAt,
    audits: [...audits, { auditedAt, status, snapshotSha256, conceptCoverage: gapReport.metrics.conceptCoverage, sources: sources.length, claims: claims.length }],
  };
  await writeJson(path.join(jobDir, researchArtifactNames.gaps), gapReport);
  await writeJson(path.join(jobDir, researchArtifactNames.run), run);
  return { gapReport, run };
}

function resolveInsideJob(jobDir, relativeFile) {
  const root = path.resolve(jobDir);
  const resolved = path.resolve(root, relativeFile);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Chapter file escapes the research job: ${relativeFile}`);
  return resolved;
}

export async function packageResearchBook({ jobDir, clock = () => new Date() }) {
  const { gapReport } = await auditResearchJob({ jobDir, clock });
  if (gapReport.status !== "ready") throw new Error(`Research is ${gapReport.status}; resolve 05-gap-report.json before packaging.`);
  const [brief, sourceCatalog, evidenceLedger, conceptGraph, curriculum] = await Promise.all([
    readJson(path.join(jobDir, researchArtifactNames.brief)),
    readJson(path.join(jobDir, researchArtifactNames.sources)),
    readJson(path.join(jobDir, researchArtifactNames.evidence)),
    readJson(path.join(jobDir, researchArtifactNames.concepts)),
    readJson(path.join(jobDir, researchArtifactNames.curriculum)),
  ]);
  if (!curriculum.title || !curriculum.summary || !Array.isArray(curriculum.chapters) || !curriculum.chapters.length) throw new Error("06-curriculum.json needs a title, summary, and at least one chapter.");
  const conceptIds = new Set(conceptGraph.concepts.map((concept) => concept.id));
  const evidenceById = new Map(evidenceLedger.claims.map((claim) => [claim.id, claim]));
  const coreConceptIds = new Set(conceptGraph.concepts.filter((concept) => concept.importance === "core").map((concept) => concept.id));
  const chapterIds = new Set();
  const coveredConceptIds = new Set();
  const chapters = [];
  const catalogUrls = new Set(sourceCatalog.sources.map((source) => source.url).filter(Boolean));
  for (const chapter of curriculum.chapters) {
    if (!chapter.id || !chapter.title || !chapter.objective || !Array.isArray(chapter.conceptIds) || !Array.isArray(chapter.evidenceClaimIds) || !Array.isArray(chapter.prerequisiteChapterIds) || !chapter.lessonFile) throw new Error("Every curriculum chapter needs id, title, objective, conceptIds, evidenceClaimIds, prerequisiteChapterIds, and lessonFile.");
    if (chapterIds.has(chapter.id)) throw new Error(`Duplicate curriculum chapter id: ${chapter.id}`);
    for (const conceptId of chapter.conceptIds) {
      if (!conceptIds.has(conceptId)) throw new Error(`Chapter ${chapter.id} references unknown concept ${conceptId}.`);
      coveredConceptIds.add(conceptId);
    }
    for (const prerequisiteId of chapter.prerequisiteChapterIds) if (!chapterIds.has(prerequisiteId)) throw new Error(`Chapter ${chapter.id} references prerequisite ${prerequisiteId} before it appears.`);
    chapterIds.add(chapter.id);
    const lesson = await readJson(resolveInsideJob(jobDir, chapter.lessonFile));
    const validation = validateLesson(lesson);
    if (validation.errors.length) throw new Error(`Chapter ${chapter.id} is invalid: ${validation.errors.map((entry) => entry.message).join("; ")}`);
    for (const source of lesson.sources) if (!catalogUrls.has(source.url)) throw new Error(`Chapter ${chapter.id} cites source outside the research catalog: ${source.url}`);
    const lessonSourceUrls = new Set(lesson.sources.map((source) => source.url));
    for (const claimId of chapter.evidenceClaimIds) {
      const claim = evidenceById.get(claimId);
      if (!claim) throw new Error(`Chapter ${chapter.id} references unknown evidence claim ${claimId}.`);
      if (!["supported", "inferred"].includes(claim.status)) throw new Error(`Chapter ${chapter.id} references unresolved evidence claim ${claimId}.`);
      if (!chapter.conceptIds.includes(claim.conceptId)) throw new Error(`Chapter ${chapter.id} evidence claim ${claimId} belongs to concept ${claim.conceptId}, which the chapter does not teach.`);
      for (const sourceId of claim.sourceIds) {
        const sourceUrl = sourceCatalog.sources.find((source) => source.id === sourceId)?.url;
        if (sourceUrl && !lessonSourceUrls.has(sourceUrl)) throw new Error(`Chapter ${chapter.id} omits the source for evidence claim ${claimId}: ${sourceUrl}`);
      }
    }
    for (const conceptId of chapter.conceptIds) if (!chapter.evidenceClaimIds.some((claimId) => evidenceById.get(claimId)?.conceptId === conceptId)) throw new Error(`Chapter ${chapter.id} has no evidence claim for concept ${conceptId}.`);
    chapters.push({ id: chapter.id, title: chapter.title, objective: chapter.objective, lessonFile: chapter.lessonFile, conceptIds: chapter.conceptIds, evidenceClaimIds: chapter.evidenceClaimIds, prerequisiteChapterIds: chapter.prerequisiteChapterIds, duration: lesson.duration });
  }
  const missingCore = [...coreConceptIds].filter((conceptId) => !coveredConceptIds.has(conceptId));
  if (missingCore.length) throw new Error(`Curriculum does not teach core concepts: ${missingCore.join(", ")}`);
  const generatedAt = clock().toISOString();
  const book = {
    version: 1,
    id: brief.id,
    title: curriculum.title,
    summary: curriculum.summary,
    audience: brief.audience,
    outcome: brief.outcome,
    depth: brief.depth,
    researchJob: ".",
    evidencePackSha256: hash({ sourceCatalog, evidenceLedger, conceptGraph }),
    generatedAt,
    chapters,
    sources: sourceCatalog.sources.map(({ id, title, type, authority, url = null }) => ({ id, title, type, authority, url })),
  };
  await writeJson(path.join(jobDir, researchArtifactNames.book), book);
  const run = await readJson(path.join(jobDir, researchArtifactNames.run));
  await writeJson(path.join(jobDir, researchArtifactNames.run), { ...run, status: "packaged", updatedAt: generatedAt, book: researchArtifactNames.book });
  return book;
}
