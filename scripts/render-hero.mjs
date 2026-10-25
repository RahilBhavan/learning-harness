// Render docs/img/offline-demo.svg from the real CLI output for examples/offline-demo.
// Usage: node scripts/render-hero.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const run = (...args) => execFileSync("node", ["bin/learn.mjs", ...args, "examples/offline-demo"], { encoding: "utf8" });
const keep = (text) => text.split("\n").filter((l) => !/^(Artifacts|Human checklist|Lesson preview|Next):?/.test(l.trim()) && l.trim() !== "");
const lines = [
  { t: "$ npm run demo:offline && learn status examples/offline-demo", c: "#FFE500" },
  ...keep(run("status")).map((t) => ({ t })),
  { t: "" },
  { t: "$ learn review examples/offline-demo", c: "#FFE500" },
  ...keep(run("review")).map((t) => ({ t })),
];
const note = "Scripted stand-in for the model: this shows the artifact stages and gates, not lesson quality.";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const mono = "ui-monospace, 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace";
const lh = 24, top = 70, W = 920, H = top + lines.length * lh + 56;
const body = lines.map((l, i) => {
  const fill = l.c ?? (/pending|required|awaiting/.test(l.t) ? "#FFB5B5" : /complete|PASS|[45]\/5/.test(l.t) ? "#B8E3BF" : "#F5F5EF");
  return `<text x="24" y="${top + i * lh}" xml:space="preserve" font-family="${mono}" font-size="14" fill="${fill}">${esc(l.t)}</text>`;
}).join("\n");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">learn status and learn review on the offline demo run: seven stages complete, automated gate passes, human review still pending</title>
<rect width="${W}" height="${H}" rx="10" fill="#111214"/>
<rect width="${W}" height="44" rx="10" fill="#202124"/><rect y="28" width="${W}" height="16" fill="#202124"/>
<text x="24" y="28" font-family="${mono}" font-size="14" fill="#F5F5EF">learning-harness, offline demo run</text>
${body}
<text x="24" y="${H - 20}" font-family="${mono}" font-size="12.5" fill="#B7B8B1">${esc(note)}</text>
</svg>
`;
mkdirSync("docs/img", { recursive: true });
writeFileSync("docs/img/offline-demo.svg", svg);
console.log("wrote docs/img/offline-demo.svg");
