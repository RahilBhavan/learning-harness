import { readFile } from "node:fs/promises";

const lessonPath = new URL("../content/harness-control-loop.json", import.meta.url);
const lesson = JSON.parse(await readFile(lessonPath, "utf8"));
const errors = [];
const required = ["title", "summary", "duration", "level", "objectives", "sections", "sources"];

for (const key of required) if (!lesson[key]) errors.push(`Missing top-level field: ${key}`);
if (!Array.isArray(lesson.sections) || lesson.sections.length < 3) errors.push("A lesson needs at least three sections.");
if (!Array.isArray(lesson.sources) || lesson.sources.length < 2) errors.push("A lesson needs at least two sources.");

const blocks = (lesson.sections ?? []).flatMap((section) => section.blocks ?? []);
const types = new Set(blocks.map((block) => block.type));
for (const requiredType of ["prose", "system-map", "simulator", "quiz", "evidence", "exercise"]) {
  if (!types.has(requiredType)) errors.push(`Missing learning primitive: ${requiredType}`);
}

for (const [sectionIndex, section] of (lesson.sections ?? []).entries()) {
  if (!/^[a-z][a-z0-9-]+$/.test(section.id ?? "")) errors.push(`Section ${sectionIndex + 1} has an invalid id.`);
  if (!Array.isArray(section.blocks) || section.blocks.length < 2) errors.push(`Section ${section.id ?? sectionIndex + 1} needs at least two blocks.`);
}

for (const quiz of blocks.filter((block) => block.type === "quiz")) {
  const correct = quiz.options?.filter((option) => option.correct).length ?? 0;
  if (correct !== 1) errors.push(`Quiz “${quiz.title}” must have exactly one correct answer.`);
  if (quiz.options?.some((option) => !option.feedback || option.feedback.length < 20)) errors.push(`Quiz “${quiz.title}” needs explanatory feedback for every option.`);
}

for (const source of lesson.sources ?? []) {
  try { new URL(source.url); } catch { errors.push(`Invalid source URL: ${source.url}`); }
}

if (errors.length) {
  console.error(errors.map((error) => `• ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated “${lesson.title}”: ${lesson.sections.length} sections, ${blocks.length} blocks, ${lesson.sources.length} sources.`);
}
