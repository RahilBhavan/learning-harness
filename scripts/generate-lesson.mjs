#!/usr/bin/env node
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runLessonPipeline } from "../harness/pipeline.mjs";
import { FixtureProvider } from "../harness/providers/fixture.mjs";
import { OpenAIProvider } from "../harness/providers/openai.mjs";

function usage() {
  return `Usage: npm run lesson:generate -- --brief <file> [options]

Options:
  --provider <openai|fixture>  Model provider (default: openai)
  --model <name>               OpenAI model; required unless OPENAI_MODEL is set
  --run-dir <directory>        Artifact directory (default: runs/<brief-id>)
  --max-repairs <number>       Repair attempts after failed evaluation (default: 1)
  --force                      Regenerate completed artifacts instead of resuming
  --install <file>             Copy the reviewed lesson JSON to an explicit content file
  --help                       Show this help

The --install option requires the generated run to pass automated gates. Human review remains required before deployment.`;
}

function parseArgs(argv) {
  const result = { provider: "openai", maxRepairs: 1, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--force") result.force = true;
    else if (argument === "--help") result.help = true;
    else if (["--brief", "--provider", "--model", "--run-dir", "--max-repairs", "--install"].includes(argument)) result[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  result.maxRepairs = Number(result.maxRepairs);
  if (!Number.isInteger(result.maxRepairs) || result.maxRepairs < 0 || result.maxRepairs > 3) throw new Error("--max-repairs must be an integer from 0 to 3.");
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) { console.log(usage()); return; }
  if (!args.brief) throw new Error(`--brief is required.\n\n${usage()}`);
  const briefPath = path.resolve(args.brief);
  const brief = JSON.parse(await readFile(briefPath, "utf8"));
  const runDir = path.resolve(args.runDir ?? path.join("runs", brief.id));
  const provider = args.provider === "fixture"
    ? new FixtureProvider()
    : args.provider === "openai"
      ? new OpenAIProvider({ model: args.model ?? process.env.OPENAI_MODEL })
      : (() => { throw new Error(`Unknown provider: ${args.provider}`); })();

  const result = await runLessonPipeline({ brief, runDir, provider, force: args.force, maxRepairs: args.maxRepairs });
  if (args.install) {
    if (!result.evaluation.publishable) throw new Error("The lesson did not pass automated gates and cannot be installed.");
    const review = await readFile(path.join(runDir, "07-human-review.md"), "utf8");
    if (!/- \[[xX]\] Approve for installation/.test(review)) throw new Error("Human approval is required: check “Approve for installation” in 07-human-review.md, then rerun with --install.");
    const target = path.resolve(args.install);
    await copyFile(path.join(runDir, "05-lesson.json"), target);
    console.log(`Installed reviewed lesson artifact at ${path.relative(process.cwd(), target) || target}.`);
  }
  console.log(`Run ${result.manifest.status}: ${path.relative(process.cwd(), runDir) || runDir}`);
  if (!result.evaluation.publishable) process.exitCode = 2;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
