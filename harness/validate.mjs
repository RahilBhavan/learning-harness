const requiredPrimitiveTypes = ["prose", "system-map", "simulator", "quiz", "evidence", "exercise"];

export function validateBrief(brief) {
  const errors = [];
  for (const field of ["id", "topic", "audience", "durationMinutes", "level", "goals", "sources"]) {
    if (brief?.[field] === undefined || brief?.[field] === null) errors.push(`Missing brief field: ${field}`);
  }
  if (!/^[a-z][a-z0-9-]+$/.test(brief?.id ?? "")) errors.push("Brief id must be a lowercase slug.");
  if (!Number.isInteger(brief?.durationMinutes) || brief.durationMinutes < 5 || brief.durationMinutes > 120) errors.push("durationMinutes must be an integer from 5 to 120.");
  if (!Array.isArray(brief?.goals) || brief.goals.length < 2) errors.push("Brief needs at least two observable goals.");
  if (!Array.isArray(brief?.sources) || brief.sources.length < 2) errors.push("Brief needs at least two trusted sources.");
  const ids = new Set();
  for (const source of brief?.sources ?? []) {
    if (!source.id || !source.label || !source.url) errors.push("Every source needs id, label, and url.");
    if (ids.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
    ids.add(source.id);
    try {
      const url = new URL(source.url);
      if (!['http:', 'https:'].includes(url.protocol)) errors.push(`Source must use http or https: ${source.url}`);
    } catch { errors.push(`Invalid source URL: ${source.url}`); }
  }
  return errors;
}

export function validateLesson(lesson) {
  const errors = [];
  const warnings = [];
  for (const key of ["title", "kicker", "summary", "duration", "level", "objectives", "sections", "sources"]) {
    if (!lesson?.[key]) errors.push({ code: "missing-field", message: `Missing lesson field: ${key}` });
  }
  if (!Array.isArray(lesson?.sections) || lesson.sections.length < 3) errors.push({ code: "section-count", message: "A lesson needs at least three sections." });
  if (!Array.isArray(lesson?.sources) || lesson.sources.length < 2) errors.push({ code: "source-count", message: "A lesson needs at least two sources." });

  const blocks = (lesson?.sections ?? []).flatMap((section) => section.blocks ?? []);
  const types = new Set(blocks.map((block) => block.type));
  for (const type of requiredPrimitiveTypes) if (!types.has(type)) errors.push({ code: "missing-primitive", message: `Missing learning primitive: ${type}` });

  const sectionIds = new Set();
  for (const [index, section] of (lesson?.sections ?? []).entries()) {
    if (!/^[a-z][a-z0-9-]+$/.test(section.id ?? "")) errors.push({ code: "section-id", message: `Section ${index + 1} has an invalid id.` });
    if (sectionIds.has(section.id)) errors.push({ code: "duplicate-section", message: `Duplicate section id: ${section.id}` });
    sectionIds.add(section.id);
    if (!Array.isArray(section.blocks) || section.blocks.length < 2) errors.push({ code: "block-count", message: `Section ${section.id ?? index + 1} needs at least two blocks.` });
  }

  for (const quiz of blocks.filter((block) => block.type === "quiz")) {
    const correct = quiz.options?.filter((option) => option.correct).length ?? 0;
    if (correct !== 1) errors.push({ code: "quiz-answer", message: `Quiz “${quiz.title}” must have exactly one correct answer.` });
    if (quiz.options?.some((option) => !option.feedback || option.feedback.length < 20)) errors.push({ code: "quiz-feedback", message: `Quiz “${quiz.title}” needs explanatory feedback for every option.` });
  }

  for (const simulator of blocks.filter((block) => block.type === "simulator")) {
    for (const control of simulator.controls ?? []) {
      if (!(control.min < control.max)) errors.push({ code: "simulator-range", message: `Simulator control “${control.label}” needs min < max.` });
      if (control.initial < control.min || control.initial > control.max) errors.push({ code: "simulator-initial", message: `Simulator control “${control.label}” starts outside its range.` });
    }
  }

  for (const evidence of blocks.filter((block) => block.type === "evidence")) {
    if (!/(source|illustrat|teaching model|reference)/i.test(evidence.note ?? "")) warnings.push({ code: "evidence-status", message: `Evidence block “${evidence.title}” should identify whether values are sourced or illustrative.` });
  }

  for (const source of lesson?.sources ?? []) {
    try { new URL(source.url); } catch { errors.push({ code: "source-url", message: `Invalid source URL: ${source.url}` }); }
  }
  return { errors, warnings, blocks, types };
}

export function evaluateArtifacts({ sourcePack, claims, plan, interactions, lesson }) {
  const deterministic = validateLesson(lesson);
  const errors = [...deterministic.errors];
  const warnings = [...deterministic.warnings];
  const sourceIds = new Set(sourcePack.sources.map((source) => source.id));
  const claimIds = new Set(claims.claims.map((claim) => claim.id));

  for (const claim of claims.claims) {
    if (claim.status === "supported" && claim.sourceIds.length === 0) errors.push({ code: "unsupported-claim", message: `Supported claim ${claim.id} has no source.` });
    for (const id of claim.sourceIds) if (!sourceIds.has(id)) errors.push({ code: "unknown-source", message: `Claim ${claim.id} cites unknown source ${id}.` });
  }
  for (const section of plan.sections) {
    for (const id of section.claimIds) if (!claimIds.has(id)) errors.push({ code: "unknown-claim", message: `Plan section ${section.id} cites unknown claim ${id}.` });
  }
  for (const interaction of interactions.interactions) {
    for (const id of interaction.evidenceClaimIds) if (!claimIds.has(id)) errors.push({ code: "interaction-claim", message: `Interaction ${interaction.id} cites unknown claim ${id}.` });
    if (interaction.type === "simulator" && interaction.variables.length < 2) errors.push({ code: "simulator-variables", message: `Simulator ${interaction.id} needs at least two causal variables.` });
  }

  const sourceUrls = new Set(sourcePack.sources.map((source) => source.url));
  for (const source of lesson.sources ?? []) if (!sourceUrls.has(source.url)) errors.push({ code: "invented-source", message: `Lesson source was not in the source pack: ${source.url}` });
  return { errors, warnings };
}
