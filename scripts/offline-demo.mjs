// Regenerates examples/offline-demo/ with the scripted provider. No network, no API keys.
// The source pack comes from the excerpts in examples/lesson-brief.json.
import { readFile, rm } from "node:fs/promises";
import { runLessonPipeline } from "../harness/pipeline.mjs";
import { TestProvider } from "../tests/helpers/scripted-provider.mjs";

const brief = JSON.parse(await readFile(new URL("../examples/lesson-brief.json", import.meta.url), "utf8"));
const runDir = new URL("../examples/offline-demo/", import.meta.url).pathname;
await rm(runDir, { recursive: true, force: true });
const noNetwork = async () => { throw new Error("The offline demo must not fetch."); };
const { manifest } = await runLessonPipeline({
  brief,
  runDir,
  provider: new TestProvider(),
  fetchImpl: noNetwork,
  clock: () => new Date("2026-08-13T12:00:00.000Z"),
});
console.log(`${manifest.status} -> examples/offline-demo/`);
