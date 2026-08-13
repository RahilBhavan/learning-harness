import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the interactive lesson shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>A harness is a control system, not a prompt file · Learning Harness<\/title>/i);
  assert.match(html, /The minimum reliable loop/);
  assert.match(html, /Tune a harness before it drifts/);
  assert.match(html, /Prediction check/);
  assert.match(html, /Run a 20-minute loop audit/);
  assert.match(html, /Source trail/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders the local lesson review workspace", async () => {
  const response = await render("/review");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Human review workspace/);
  assert.match(html, /05-lesson\.json/);
  assert.match(html, /not uploaded, installed, or published/);
  assert.match(html, /type="file"/);
});

test("renders landmark and accessible interaction labels", async () => {
  const html = await (await render()).text();
  assert.match(html, /<main id="top">/);
  assert.match(html, /aria-label="The minimum reliable loop"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /type="range"/);
});
