#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runLessonPipeline } from "../harness/pipeline.mjs";
import { createBenchmarkJob, inspectBenchmarkJob, runBenchmarkLoop } from "../harness/benchmark.mjs";
import { AnthropicProvider } from "../harness/providers/anthropic.mjs";
import { OpenAIProvider } from "../harness/providers/openai.mjs";
import { approveRun, inspectRun, installRun } from "../harness/run-store.mjs";

const VERSION = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const valueOptions = new Set(["brief", "provider", "model", "run-dir", "job-dir", "definition", "max-repairs", "to", "reviewer", "note"]);
const booleanOptions = new Set(["force", "json", "yes", "help", "version", "no-color"]);

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "-h") { options.help = true; continue; }
    if (token === "-v") { options.version = true; continue; }
    if (!token.startsWith("--")) { positionals.push(token); continue; }
    const raw = token.slice(2);
    const [name, inline] = raw.split(/=(.*)/s, 2);
    if (booleanOptions.has(name)) { options[name] = true; continue; }
    if (!valueOptions.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = inline ?? argv[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`--${name} requires a value.`);
    options[name] = value;
  }
  return { command: positionals.shift(), positionals, options };
}

function usage() {
  return `Learning Harness ${VERSION}

Usage:
  learn generate <brief.json> [--provider openai|anthropic] [--model <name>]
  learn status <run-directory> [--json]
  learn review <run-directory>
  learn approve <run-directory> --reviewer <name> [--note <text>] [--yes]
  learn install <run-directory> --to <lesson.json> [--force]
  learn benchmark init --job-dir <directory> [--definition <file>]
  learn benchmark run <job-directory> [--json]
  learn benchmark status <job-directory> [--json]
  learn doctor [--provider openai|anthropic] [--json]

Generate options:
  --run-dir <path>       Artifact directory (default: runs/<brief-id>)
  --max-repairs <0..3>  Bounded repair attempts (default: 1)
  --force                Regenerate checkpointed artifacts
  --json                 Emit a machine-readable result

Environment:
  OPENAI_API_KEY + OPENAI_MODEL
  ANTHROPIC_API_KEY + ANTHROPIC_MODEL

There is no demo or fixture provider. Generation always uses a configured live model.`;
}

const stageLabels = {
  brief: "Brief validated",
  sources: "Sources captured",
  claims: "Claims grounded",
  plan: "Learning plan designed",
  interactions: "Interactions specified",
  lesson: "Lesson authored",
  evaluation: "Quality gates evaluated",
};

function terminal({ noColor = false } = {}) {
  const color = process.stderr.isTTY && !noColor;
  const paint = (code, value) => color ? `\u001b[${code}m${value}\u001b[0m` : value;
  return {
    info(message) { process.stderr.write(`${paint("36", "◆")} ${message}\n`); },
    success(message) { process.stderr.write(`${paint("32", "✓")} ${message}\n`); },
    warn(message) { process.stderr.write(`${paint("33", "!")} ${message}\n`); },
    event(event) {
      if (event.type === "repair") return this.warn(`Repairing lesson (${event.attempt}/${event.maxRepairs})`);
      if (event.type !== "stage") return;
      const label = stageLabels[event.stage] ?? event.stage;
      if (event.status === "running") this.info(label);
      else if (event.status === "reused") this.success(`${label} ${paint("2", "(checkpoint)")}`);
      else if (event.status === "blocked") this.warn(`${label} — blocked`);
      else this.success(label);
    },
  };
}

function providerFrom(options) {
  const name = options.provider ?? "openai";
  if (name === "openai") return new OpenAIProvider({ model: options.model ?? process.env.OPENAI_MODEL });
  if (["anthropic", "claude"].includes(name)) return new AnthropicProvider({ model: options.model ?? process.env.ANTHROPIC_MODEL });
  throw new Error(`Unsupported provider: ${name}. Choose openai or anthropic.`);
}

function runPath(value) {
  if (!value) throw new Error("A run directory is required.");
  return path.resolve(value);
}

async function generate(args, output) {
  const briefFile = args.options.brief ?? args.positionals[0];
  if (!briefFile) throw new Error("A brief JSON file is required.");
  const briefPath = path.resolve(briefFile);
  const brief = JSON.parse(await readFile(briefPath, "utf8"));
  const runDir = path.resolve(args.options["run-dir"] ?? path.join("runs", brief.id));
  const maxRepairs = Number(args.options["max-repairs"] ?? 1);
  if (!Number.isInteger(maxRepairs) || maxRepairs < 0 || maxRepairs > 3) throw new Error("--max-repairs must be an integer from 0 to 3.");
  const provider = providerFrom(args.options);
  if (!args.options.json) output.info(`Generating “${brief.topic}” with ${provider.id}/${provider.model}`);
  const result = await runLessonPipeline({
    brief,
    runDir,
    provider,
    force: Boolean(args.options.force),
    maxRepairs,
    onEvent: args.options.json ? undefined : (event) => output.event(event),
  });
  const summary = { status: result.manifest.status, runDir, publishable: result.evaluation.publishable, repairs: result.evaluation.repairAttempts };
  if (args.options.json) console.log(JSON.stringify(summary));
  else {
    const writer = summary.publishable ? output.success.bind(output) : output.warn.bind(output);
    writer(`${summary.status}. Artifacts: ${runDir}`);
    output.info(`Next: learn review ${JSON.stringify(runDir)}`);
  }
  if (!summary.publishable) process.exitCode = 2;
}

async function status(args) {
  const runDir = runPath(args.positionals[0]);
  const state = await inspectRun(runDir);
  const result = {
    runDir,
    runId: state.manifest.runId,
    topic: state.manifest.topic,
    status: state.approvalValid ? "approved" : state.manifest.status,
    provider: state.manifest.provider,
    model: state.manifest.model,
    publishable: state.evaluation?.publishable ?? false,
    approved: state.approvalValid,
    stages: state.manifest.stages,
  };
  if (args.options.json) return console.log(JSON.stringify(result, null, 2));
  console.log(`${result.topic}\n${result.status} · ${result.provider}/${result.model}`);
  for (const [name, stage] of Object.entries(result.stages)) console.log(`  ${stage.status.padEnd(13)} ${stageLabels[name] ?? name}`);
  console.log(`\nArtifacts: ${runDir}`);
}

async function review(args) {
  const runDir = runPath(args.positionals[0]);
  const { manifest, evaluation, approvalValid } = await inspectRun(runDir);
  if (!evaluation) throw new Error("This run has no evaluation report yet.");
  console.log(`${manifest.topic}\n`);
  console.log(`Automated gate: ${evaluation.publishable ? "PASS" : "BLOCKED"}`);
  for (const [name, score] of Object.entries(evaluation.modelReview.scores)) console.log(`  ${name.padEnd(24)} ${score}/5`);
  const issues = [...evaluation.deterministic.errors, ...evaluation.deterministic.warnings, ...evaluation.modelReview.issues];
  console.log(`\nIssues: ${issues.length}`);
  for (const issue of issues) console.log(`  [${issue.severity ?? "error"}] ${issue.code}: ${issue.message}`);
  console.log(`\nHuman checklist: ${path.join(runDir, "07-human-review.md")}`);
  console.log(`Lesson preview:  ${path.join(runDir, "05-lesson.json")}`);
  console.log(`Approval:        ${approvalValid ? "valid" : "required"}`);
  if (evaluation.publishable && !approvalValid) console.log(`\nNext: learn approve ${JSON.stringify(runDir)} --reviewer ${JSON.stringify("Your Name")}`);
}

async function approve(args, output) {
  const runDir = runPath(args.positionals[0]);
  const reviewer = args.options.reviewer;
  if (!reviewer) throw new Error("--reviewer is required.");
  const { evaluation } = await inspectRun(runDir);
  if (!evaluation?.publishable) throw new Error("Automated quality gates are blocked; this run cannot be approved.");
  if (!args.options.yes) {
    if (!process.stdin.isTTY) throw new Error("Approval requires an interactive terminal or the explicit --yes flag.");
    console.log("You are approving accuracy, citations, interaction integrity, assessment quality, and accessibility.");
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question("Type APPROVE to sign this exact lesson: ");
    prompt.close();
    if (answer !== "APPROVE") throw new Error("Approval cancelled.");
  }
  const approval = await approveRun({ runDir, reviewer, note: args.options.note });
  output.success(`Approved by ${approval.reviewer}. The approval is bound to this exact lesson.`);
}

async function install(args, output) {
  const runDir = runPath(args.positionals[0]);
  if (!args.options.to) throw new Error("--to is required.");
  const target = path.resolve(args.options.to);
  await installRun({ runDir, target, force: Boolean(args.options.force) });
  output.success(`Installed approved lesson: ${target}`);
}

async function benchmark(args, output) {
  const subcommand = args.positionals.shift();
  if (!subcommand || subcommand === "help") {
    console.log(`Usage:\n  learn benchmark init --job-dir <directory> [--definition <file>]\n  learn benchmark run <job-directory> [--json]\n  learn benchmark status <job-directory> [--json]\n\nThe run command audits dated evidence, excludes stale or unsupported scores, writes the scorecard and report, and proposes implementation experiments from verified product gaps.`);
    return;
  }
  if (subcommand === "init") {
    if (!args.options["job-dir"]) throw new Error("benchmark init requires --job-dir.");
    const definitionFile = path.resolve(args.options.definition ?? fileURLToPath(new URL("../benchmarks/reference-sites/00-benchmark.json", import.meta.url)));
    const definition = JSON.parse(await readFile(definitionFile, "utf8"));
    const jobDir = path.resolve(args.options["job-dir"]);
    await createBenchmarkJob({ jobDir, definition });
    output.success(`Created benchmark research job: ${jobDir}`);
    output.info(`Collect evidence in ${path.join(jobDir, "01-observations.json")}, then run: learn benchmark run ${JSON.stringify(jobDir)}`);
    return;
  }
  const jobDir = runPath(args.positionals[0]);
  if (subcommand === "run") {
    const result = await runBenchmarkLoop({ jobDir });
    const summary = { status: result.scorecard.status, jobDir, rankableTargets: result.scorecard.targets.filter((target) => target.rankable).length, experiments: result.experiments.experiments.length, report: path.join(jobDir, "04-report.md") };
    if (args.options.json) console.log(JSON.stringify(summary));
    else {
      const writer = summary.status === "ready" ? output.success.bind(output) : output.warn.bind(output);
      writer(`Benchmark ${summary.status}: ${summary.rankableTargets}/${result.scorecard.targets.length} targets rankable; ${summary.experiments} implementation experiment(s).`);
      output.info(`Report: ${summary.report}`);
    }
    if (summary.status !== "ready") process.exitCode = 2;
    return;
  }
  if (subcommand === "status") {
    const state = await inspectBenchmarkJob(jobDir);
    const summary = { jobDir, status: state.run.status, updatedAt: state.run.updatedAt, runs: state.run.runs.length, targets: state.scorecard?.targets ?? [] };
    if (args.options.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(`${state.run.id}\n${summary.status} · ${summary.runs} benchmark run(s)`);
      for (const target of summary.targets) console.log(`  ${target.rankable ? target.overall.toFixed(2) : "n/a"}  ${Math.round(target.coverage * 100)}%  ${target.label}`);
    }
    return;
  }
  throw new Error(`Unknown benchmark command: ${subcommand}`);
}

function doctor(args) {
  const selected = args.options.provider;
  if (selected && !["openai", "anthropic", "claude"].includes(selected)) throw new Error(`Unsupported provider: ${selected}.`);
  const currentNode = process.versions.node.split(".").map(Number);
  const nodeReady = currentNode[0] > 22 || (currentNode[0] === 22 && (currentNode[1] > 13 || (currentNode[1] === 13 && currentNode[2] >= 0)));
  const checks = [
    { name: "Node.js >= 22.13", ok: nodeReady, detail: process.versions.node },
    { name: "OpenAI API key", ok: Boolean(process.env.OPENAI_API_KEY), detail: "OPENAI_API_KEY" },
    { name: "OpenAI model", ok: Boolean(process.env.OPENAI_MODEL), detail: "OPENAI_MODEL" },
    { name: "Anthropic API key", ok: Boolean(process.env.ANTHROPIC_API_KEY), detail: "ANTHROPIC_API_KEY" },
    { name: "Anthropic model", ok: Boolean(process.env.ANTHROPIC_MODEL), detail: "ANTHROPIC_MODEL" },
  ];
  const relevant = selected === "openai" ? checks.slice(0, 3) : ["anthropic", "claude"].includes(selected) ? [checks[0], ...checks.slice(3)] : checks;
  const ready = selected ? relevant.every((check) => check.ok) : relevant[0].ok && (relevant.slice(1, 3).every((check) => check.ok) || relevant.slice(3).every((check) => check.ok));
  if (args.options.json) console.log(JSON.stringify({ ready, checks: relevant }, null, 2));
  else {
    for (const check of relevant) console.log(`${check.ok ? "✓" : "✗"} ${check.name}${check.ok && check.name.startsWith("Node") ? ` (${check.detail})` : ""}`);
    console.log(ready ? "\nReady to generate." : "\nConfiguration incomplete. Set one provider key/model pair.");
  }
  if (!ready) process.exitCode = 2;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.options.version) return console.log(VERSION);
  if (args.options.help || !args.command || args.command === "help") return console.log(usage());
  const output = terminal({ noColor: args.options["no-color"] });
  if (args.command === "generate") return generate(args, output);
  if (args.command === "status") return status(args);
  if (args.command === "review") return review(args);
  if (args.command === "approve") return approve(args, output);
  if (args.command === "install") return install(args, output);
  if (args.command === "benchmark") return benchmark(args, output);
  if (args.command === "doctor") return doctor(args);
  throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) main().catch((error) => { process.stderr.write(`Error: ${error.message}\n`); process.exitCode = 1; });
