import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { retiredBuildInputs } from "./lib/retired-sources.mjs";

// Validate emitted capabilities as well as the full build dependency graph.
export const requiredStandaloneInputs = [
  'packages/tui/src/auth/application.ts',
  'packages/tui/src/runtime/auth-session.ts',
  'packages/tui/src/runtime/mcode-tools-integration.ts',
  'packages/tui/src/account/matrix-account-client.ts',
  'packages/tui/src/checkin/http-gateway.ts',
  'packages/tui/src/runtime/feedback/service.ts',
  'packages/local-runtime-v2/src/service/plugin-system/plugin/runtime/registry-client.ts',
  'packages/local-runtime-v2/src/service/plugin-system/app/cloud-client.ts',
  'packages/local-runtime-v2/src/service/model-system/catalog/provider-presets/provider-presets.client.ts',
  'packages/local-runtime/src/web-search/local-web-search-client.ts',
  'packages/local-runtime/src/permissions/llm-judge-gateway-client.ts',
  "packages/tui/src/cli/main.ts",
  "packages/tui/src/tui/controller/product/update-flow.ts",
];

export function checkStandaloneBoundary(metafile) {
  const violations = Object.keys(metafile.inputs).filter((input) =>
    retiredBuildInputs.some((prefix) => input.startsWith(prefix)),
  );
  if (violations.length) {
    throw new Error(`Forbidden source reached the CLI build: ${violations.join(", ")}`);
  }
  const emitted = new Set(Object.values(metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, input]) => input.bytesInOutput > 0)
      .map(([name]) => name)));
  const missing = requiredStandaloneInputs.filter((input) => !emitted.has(input));
  if (missing.length) {
    throw new Error(`Required TUI capabilities are absent from the built code: ${missing.join(", ")}`);
  }
}

// Importing the checker for offline tests must not read or require dist.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const metafile = JSON.parse(
    readFileSync(new URL("../dist/metafile.json", import.meta.url), "utf8"),
  );
  checkStandaloneBoundary(metafile);
  console.log("Standalone build dependency boundary passed.");
}
