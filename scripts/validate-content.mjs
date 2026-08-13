import { readFile } from "node:fs/promises";
import { validateLesson } from "../harness/validate.mjs";

const lessonPath = new URL("../content/harness-control-loop.json", import.meta.url);
const lesson = JSON.parse(await readFile(lessonPath, "utf8"));
const result = validateLesson(lesson);

if (result.errors.length) {
  console.error(result.errors.map((error) => `• ${error.message}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated “${lesson.title}”: ${lesson.sections.length} sections, ${result.blocks.length} blocks, ${lesson.sources.length} sources.`);
  for (const warning of result.warnings) console.warn(`Warning: ${warning.message}`);
}
