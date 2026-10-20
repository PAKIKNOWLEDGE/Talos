import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { dirname, join } from 'node:path';

import yaml from 'js-yaml';
import lockfile from 'proper-lockfile';

import { getConfig, getConfigPath, resetConfig, type Config } from './config.js';
import { parsePermissionJudgeConfig, type PermissionJudgeConfig } from './permission-config.js';

const LOCAL_CONFIG_FILE_MODE = 0o600;
const DANGEROUS_CONFIG_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export class PermissionJudgeConfigError extends Error {
  override name = 'PermissionJudgeConfigError';
}

export async function writePermissionJudgeConfig(
  judge: PermissionJudgeConfig | null,
): Promise<{ readonly config: Config }> {
  const parsed = judge === null ? null : parsePermissionJudgeConfig(judge);
  if (judge !== null && !parsed) {
    throw new PermissionJudgeConfigError('Incomplete LLM judge configuration');
  }
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
    const permission =
      raw.permission && typeof raw.permission === 'object' && !Array.isArray(raw.permission)
        ? { ...(raw.permission as Record<string, unknown>) }
        : {};
    if (parsed) permission.judge = parsed;
    else delete permission.judge;
    if (Object.keys(permission).length > 0) raw.permission = permission;
    else delete raw.permission;
    assertSafeConfigRecord(raw);
    await atomicWriteFile(configPath, yaml.dump(raw, { indent: 2, lineWidth: -1, noRefs: true }));
    resetConfig();
    return { config: getConfig() };
  } catch (error) {
    if (error instanceof PermissionJudgeConfigError) throw error;
    throw new PermissionJudgeConfigError('Could not save the LLM judge configuration');
  } finally {
    await release?.().catch(() => undefined);
  }
}

function readLocalRawConfig(configPath: string): Record<string, unknown> {
  const source = fs.readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch {
    throw new PermissionJudgeConfigError('Invalid config.yaml: unable to parse YAML');
  }
  if (parsed == null) return {};
  if (!isPlainRecord(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
    throw new PermissionJudgeConfigError('Invalid config.yaml: expected a YAML mapping');
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
    throw new PermissionJudgeConfigError('Could not save the LLM judge configuration');
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertSafeConfigRecord(value: Record<string, unknown>, path = 'config'): void {
  for (const key of Object.keys(value)) {
    if (DANGEROUS_CONFIG_PATH_SEGMENTS.has(key)) {
      throw new PermissionJudgeConfigError(`Invalid config path ${path}.${key}`);
    }
    const nested = value[key];
    if (isPlainRecord(nested)) assertSafeConfigRecord(nested, `${path}.${key}`);
  }
}
