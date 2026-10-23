import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join } from 'node:path';

import yaml from 'js-yaml';
import lockfile from 'proper-lockfile';

import { getConfig, getConfigPath, resetConfig, type Config } from './config.js';
import {
  parseWebSearchConfig,
  WEB_SEARCH_NAMED_KEY_FIELDS,
  WEB_SEARCH_PROVIDER_IDS,
  type WebSearchConfig,
  type WebSearchNamedKeyField,
  type WebSearchProviderPreference,
} from './web-search-config.js';

const LOCAL_CONFIG_FILE_MODE = 0o600;
const DANGEROUS_CONFIG_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export class WebSearchConfigError extends Error {
  override name = 'WebSearchConfigError';
}

export interface WebSearchConfigPatch {
  provider?: WebSearchProviderPreference;
  tavilyApiKey?: string | null;
  exaApiKey?: string | null;
  deepseekApiKey?: string | null;
}

export async function writeWebSearchConfig(
  patch: WebSearchConfigPatch,
): Promise<{ readonly config: Config }> {
  const configPath = getConfigPath();
  let release: (() => Promise<void>) | undefined;
  try {
    await fs.promises.mkdir(dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, '', { flag: 'a', mode: LOCAL_CONFIG_FILE_MODE });
    await fs.promises.chmod(configPath, LOCAL_CONFIG_FILE_MODE);
    release = await lockfile.lock(configPath, {
      stale: 10_000,
      retries: { retries: 20, factor: 1, minTimeout: 5, maxTimeout: 25 },
    });
    const raw = readLocalRawConfig(configPath);
    const next = serializeWebSearchConfig(applyWebSearchPatch(parseWebSearchConfig(raw.webSearch), patch));
    if (Object.keys(next).length > 0) raw.webSearch = next;
    else delete raw.webSearch;
    assertSafeConfigRecord(raw);
    await atomicWriteFile(configPath, yaml.dump(raw, { indent: 2, lineWidth: -1, noRefs: true }));
    resetConfig();
    return { config: getConfig() };
  } catch (error) {
    if (error instanceof WebSearchConfigError) throw error;
    throw new WebSearchConfigError('Could not save the web search configuration');
  } finally {
    await release?.().catch(() => undefined);
  }
}

export function applyWebSearchPatch(
  existing: WebSearchConfig,
  patch: WebSearchConfigPatch,
): WebSearchConfig {
  const next: WebSearchConfig = {
    provider: patch.provider ?? existing.provider,
  };
  for (const id of WEB_SEARCH_PROVIDER_IDS) {
    const field = WEB_SEARCH_NAMED_KEY_FIELDS[id];
    const patched = patch[field];
    if (patched === null) continue;
    const value = typeof patched === 'string' ? patched.trim() : existing[field];
    if (value) next[field] = value;
  }
  if (existing.apiKey?.trim() && next.provider !== 'auto') {
    const namedField = WEB_SEARCH_NAMED_KEY_FIELDS[next.provider];
    if (!next[namedField]) next.apiKey = existing.apiKey.trim();
  }
  return parseWebSearchConfig(next);
}

function serializeWebSearchConfig(config: WebSearchConfig): Record<string, string> {
  const raw: Record<string, string> = { provider: config.provider };
  if (config.apiKey) raw.apiKey = config.apiKey;
  for (const id of WEB_SEARCH_PROVIDER_IDS) {
    const field: WebSearchNamedKeyField = WEB_SEARCH_NAMED_KEY_FIELDS[id];
    const value = config[field];
    if (value) raw[field] = value;
  }
  return raw;
}

function readLocalRawConfig(configPath: string): Record<string, unknown> {
  const source = fs.readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch {
    throw new WebSearchConfigError('Invalid config.yaml: unable to parse YAML');
  }
  if (parsed == null) return {};
  if (!isPlainRecord(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
    throw new WebSearchConfigError('Invalid config.yaml: expected a YAML mapping');
  }
  return parsed;
}

async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tmpPath = join(dirname(filePath), `.config-tmp-${randomBytes(6).toString('hex')}`);
  let created = false;
  try {
    const temporary = await fs.promises.open(tmpPath, 'wx', LOCAL_CONFIG_FILE_MODE);
    created = true;
    try {
      await temporary.writeFile(content, 'utf-8');
      await temporary.chmod(LOCAL_CONFIG_FILE_MODE);
    } finally {
      await temporary.close();
    }
    await fs.promises.rename(tmpPath, filePath);
  } catch {
    if (created) await fs.promises.unlink(tmpPath).catch(() => undefined);
    throw new WebSearchConfigError('Could not save the web search configuration');
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertSafeConfigRecord(value: Record<string, unknown>, path = 'config'): void {
  for (const key of Object.keys(value)) {
    if (DANGEROUS_CONFIG_PATH_SEGMENTS.has(key)) {
      throw new WebSearchConfigError(`Invalid config path ${path}.${key}`);
    }
    const nested = value[key];
    if (isPlainRecord(nested)) assertSafeConfigRecord(nested, `${path}.${key}`);
  }
}
