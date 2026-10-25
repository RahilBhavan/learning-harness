// The built Worker imports `cloudflare:workers`, a module only the Workers
// runtime provides. Node's default loader rejects the `cloudflare:` scheme,
// so the rendered-HTML tests preload this file to map it to an empty stub.
// vinext only reads the optional `tracing` export, which the stub omits.
import module from "node:module";

const STUB_URL = new URL("./cloudflare-workers-stub.mjs", import.meta.url).href;

function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: STUB_URL, shortCircuit: true };
  if (specifier.startsWith("cloudflare:")) {
    throw new Error(`Test loader has no stub for ${specifier}. Add one in tests/support/.`);
  }
  return nextResolve(specifier, context);
}

module.registerHooks({ resolve });
