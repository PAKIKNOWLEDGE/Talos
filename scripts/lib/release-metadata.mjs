import { readFileSync } from "node:fs";
import path from "node:path";

// Canonical locations of the machine-read release contracts. These are build and
// verification inputs, not documentation: `release/extraction.json` pins the source
// baseline and package scope, `release/public-source.json` is the reviewed file
// inventory, `release/dependency-licenses.json` records declared dependency
// licenses, and `release/talos-release.json` is the Talos npm/GitHub ship procedure.
// Import these constants instead of repeating the literal paths.
export const extractionPath = "release/extraction.json";
export const inventoryPath = "release/public-source.json";
export const dependencyLicensesPath = "release/dependency-licenses.json";
export const talosReleasePath = "release/talos-release.json";

function readJson(root, relative) {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
}

export function readExtraction(root) {
  return readJson(root, extractionPath);
}

export function readInventory(root) {
  return readJson(root, inventoryPath);
}

export function readTalosRelease(root) {
  return readJson(root, talosReleasePath);
}
