import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const run = promisify(execFile);
const cli = fileURLToPath(new URL("../bin/learn.mjs", import.meta.url));
const brief = fileURLToPath(new URL("../examples/lesson-brief.json", import.meta.url));

test("CLI exposes the production command surface without a fixture provider", async () => {
  const { stdout } = await run(process.execPath, [cli, "--help"]);
  assert.match(stdout, /learn generate/);
  assert.match(stdout, /learn approve/);
  assert.match(stdout, /learn benchmark run/);
  assert.match(stdout, /no demo or fixture provider/i);
  assert.doesNotMatch(stdout, /openai\|anthropic\|fixture/);
});

test("CLI rejects non-production providers", async () => {
  await assert.rejects(
    run(process.execPath, [cli, "generate", brief, "--provider", "fixture"]),
    (error) => error.code === 1 && /Unsupported provider: fixture/.test(error.stderr),
  );
});

test("doctor reports missing live configuration without revealing values", async () => {
  await assert.rejects(
    run(process.execPath, [cli, "doctor", "--provider", "openai", "--json"], {
      env: { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
    }),
    (error) => {
      const result = JSON.parse(error.stdout);
      assert.equal(error.code, 2);
      assert.equal(result.ready, false);
      assert.equal(result.checks.find((check) => check.name === "OpenAI API key").detail, "OPENAI_API_KEY");
      assert.doesNotMatch(error.stdout, /sk-/);
      return true;
    },
  );
});
