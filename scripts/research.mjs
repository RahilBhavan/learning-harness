#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { auditResearchJob, createResearchJob, importChatGPTExport, packageResearchBook, slugifyTopic } from "../harness/research.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command: command === "--help" ? undefined : command, help: command === "--help" };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--help") args.help = true;
    else if (argument.startsWith("--")) {
      const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = rest[++index];
      if (value === undefined) throw new Error(`${argument} requires a value.`);
      args[key] = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run research:start -- --topic <topic> [--id <slug>] [--audience <text>] [--outcome <text>] [--depth <text>] [--study-hours <number>] [--job-dir <path>]
  npm run research:import-chatgpt -- --job-dir <path> --file <conversations.json> [--limit <number>]
  npm run research:audit -- --job-dir <path>
  npm run research:package -- --job-dir <path>`;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || !args.command) { console.log(usage()); return; }
  if (args.command === "start") {
    if (!args.topic) throw new Error(`--topic is required.\n\n${usage()}`);
    const id = args.id ?? slugifyTopic(args.topic);
    const jobDir = path.resolve(args.jobDir ?? path.join("research", id));
    await createResearchJob({
      jobDir,
      id,
      topic: args.topic,
      audience: args.audience,
      outcome: args.outcome,
      depth: args.depth,
      studyHours: args.studyHours === undefined ? undefined : Number(args.studyHours),
    });
    console.log(`Created research job: ${path.relative(process.cwd(), jobDir) || jobDir}`);
    console.log(`Next: invoke $research-textbook and point it at that directory.`);
    return;
  }
  if (!args.jobDir) throw new Error(`--job-dir is required.\n\n${usage()}`);
  const jobDir = path.resolve(args.jobDir);
  if (args.command === "import-chatgpt") {
    if (!args.file) throw new Error(`--file is required.\n\n${usage()}`);
    const result = await importChatGPTExport({ jobDir, exportFile: path.resolve(args.file), limit: args.limit === undefined ? undefined : Number(args.limit) });
    console.log(`Imported ${result.imported} ChatGPT conversation(s) as learner notes; skipped ${result.skipped}.`);
    return;
  }
  if (args.command === "audit") {
    const { gapReport } = await auditResearchJob({ jobDir });
    console.log(`Research ${gapReport.status}: ${(gapReport.metrics.conceptCoverage * 100).toFixed(0)}% core coverage, ${gapReport.metrics.sources} sources, ${gapReport.issues.length} issue(s).`);
    if (gapReport.status === "blocked") process.exitCode = 2;
    return;
  }
  if (args.command === "package") {
    const book = await packageResearchBook({ jobDir });
    console.log(`Packaged “${book.title}”: ${book.chapters.length} chapter(s), ${book.sources.length} source(s).`);
    return;
  }
  throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
