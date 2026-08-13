import { createHash } from "node:crypto";

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function htmlToText(html) {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildSourcePack(brief, { fetchImpl = fetch, clock = () => new Date() } = {}) {
  const sources = [];
  for (const source of brief.sources) {
    let text = source.excerpt?.trim() ?? "";
    let captureMethod = "provided-excerpt";
    if (!text) {
      const response = await fetchImpl(source.url, {
        headers: { "user-agent": "LearningHarness/0.1 (+research source capture)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Could not fetch ${source.url}: HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        throw new Error(`Unsupported source type for ${source.url}: ${contentType || "unknown"}. Supply an excerpt for PDFs and other binary formats.`);
      }
      const raw = await response.text();
      text = contentType.includes("text/html") ? htmlToText(raw) : raw.trim();
      captureMethod = contentType.includes("text/html") ? "html-text" : "plain-text";
    }
    if (text.length < 80) throw new Error(`Source ${source.id} contains too little usable text.`);
    const bounded = text.slice(0, 40_000);
    sources.push({
      id: source.id,
      label: source.label,
      url: source.url,
      text: bounded,
      truncated: text.length > bounded.length,
      captureMethod,
      sha256: createHash("sha256").update(bounded).digest("hex"),
    });
  }
  return {
    capturedAt: clock().toISOString(),
    sourcePolicy: brief.sourcePolicy ?? "Use only the supplied trusted sources; record gaps instead of inventing evidence.",
    sources,
  };
}
