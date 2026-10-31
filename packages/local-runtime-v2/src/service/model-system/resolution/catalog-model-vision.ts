import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import type { LocalModelConfig } from '../contracts.js';
import { parseProviderId } from './model-key.js';

type CatalogImageVerdict = 'image' | 'text' | 'conflict';

let verdicts: Map<string, CatalogImageVerdict> | undefined;
let sourcePath: string | undefined;
let sourceLoaded = false;

/** Points resolve-time vision lookup at the on-disk models.dev snapshot. */
export function rememberCatalogVisionSource(path: string | undefined): void {
  if (path === sourcePath) return;
  sourcePath = path;
  sourceLoaded = false;
  verdicts = undefined;
}

/** Replaces the in-memory index from an already parsed models.dev catalog body. */
export function noteCatalogVision(catalog: Record<string, unknown>): void {
  verdicts = indexCatalogVision(catalog);
  sourceLoaded = true;
}

export function resetCatalogVisionForTests(): void {
  verdicts = undefined;
  sourcePath = undefined;
  sourceLoaded = false;
}

/**
 * Exact model-id agreement across catalog providers.
 * `undefined` means unknown or a conflict, so the caller stays fail-closed.
 */
export function catalogDeclaresImageInput(modelId: string): boolean | undefined {
  const verdict = visionIndex().get(modelId);
  if (verdict === 'image') return true;
  if (verdict === 'text') return false;
  return undefined;
}

/**
 * Saved image choice. `undefined` means the model never declared vision, which
 * is the only case allowed to inherit a catalog match.
 */
export function explicitImageSupport(model: LocalModelConfig | undefined): boolean | undefined {
  if (!model) return undefined;
  const input = model.modalities?.input;
  if (Array.isArray(input) && input.includes('image')) return true;
  if (model.capabilities?.support_image === true) return true;
  if (model.capabilities?.support_image === false) return false;
  if (Array.isArray(input)) return false;
  return undefined;
}

export function resolvedImageSupport(
  providerId: string,
  modelId: string,
  model: LocalModelConfig | undefined,
): boolean {
  const explicit = explicitImageSupport(model);
  if (explicit !== undefined) return explicit;
  if (parseProviderId(providerId)?.source !== 'custom_provider') return false;
  return catalogDeclaresImageInput(modelId) === true;
}

function visionIndex(): Map<string, CatalogImageVerdict> {
  if (sourceLoaded && verdicts) return verdicts;
  if (!sourceLoaded) {
    sourceLoaded = true;
    verdicts = sourcePath ? readCatalogVision(sourcePath) : new Map();
  }
  return verdicts ?? new Map();
}

function readCatalogVision(filePath: string): Map<string, CatalogImageVerdict> {
  try {
    const raw = readFileSync(filePath);
    const text = filePath.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    const parsed: unknown = JSON.parse(text);
    const body =
      isRecord(parsed) && isRecord(parsed.catalog) ? parsed.catalog : parsed;
    return isRecord(body) ? indexCatalogVision(body) : new Map();
  } catch {
    return new Map();
  }
}

function indexCatalogVision(catalog: Record<string, unknown>): Map<string, CatalogImageVerdict> {
  const index = new Map<string, CatalogImageVerdict>();
  for (const provider of Object.values(catalog)) {
    if (!isRecord(provider) || !isRecord(provider.models)) continue;
    for (const [modelId, model] of Object.entries(provider.models)) {
      if (!isRecord(model) || !isRecord(model.modalities)) continue;
      const input = model.modalities.input;
      if (!Array.isArray(input)) continue;
      const id = modelId.trim();
      if (!id) continue;
      const next: CatalogImageVerdict = input.includes('image') ? 'image' : 'text';
      const previous = index.get(id);
      if (!previous) index.set(id, next);
      else if (previous !== next) index.set(id, 'conflict');
    }
  }
  return index;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
