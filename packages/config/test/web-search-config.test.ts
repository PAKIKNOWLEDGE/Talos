import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, resetConfig, resolveConfigFromRaw } from '../src/config.js';
import { parseWebSearchConfig, webSearchSettingsView } from '../src/web-search-config.js';
import { writeWebSearchConfig } from '../src/web-search-config-write.js';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(join(os.tmpdir(), 'talos-web-search-config-'));
  vi.stubEnv('MINIMAX_DATA_DIR', dataDir);
  vi.stubEnv('__MAVIS_RUNTIME_DATA_DIR', dataDir);
  vi.stubEnv('__MAVIS_RUNTIME_DISABLE_GIT_AUTO_CONFIG', '1');
  resetConfig();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfig();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('webSearch config', () => {
  it('defaults to auto with no vendor binding', () => {
    expect(resolveConfigFromRaw({}, dataDir).webSearch).toEqual({ provider: 'auto' });
    expect(parseWebSearchConfig(undefined)).toEqual({ provider: 'auto' });
  });

  it('accepts an explicit REST backend', () => {
    expect(
      resolveConfigFromRaw({ webSearch: { provider: 'tavily', apiKey: ' tvly-x ' } }, dataDir)
        .webSearch,
    ).toEqual({ provider: 'tavily', apiKey: 'tvly-x' });
  });

  it('ignores unknown providers instead of restoring Matrix', () => {
    expect(parseWebSearchConfig({ provider: 'matrix' })).toEqual({ provider: 'auto' });
    expect(parseWebSearchConfig({ provider: 'minimax' })).toEqual({ provider: 'auto' });
  });

  it('keeps per-backend keys for Auto', () => {
    expect(
      parseWebSearchConfig({
        provider: 'auto',
        tavilyApiKey: ' tvly-a ',
        exaApiKey: 'exa-a',
      }),
    ).toEqual({
      provider: 'auto',
      tavilyApiKey: 'tvly-a',
      exaApiKey: 'exa-a',
    });
  });

  it('writes /settings web search keys into config.yaml', async () => {
    fs.writeFileSync(join(dataDir, 'config.yaml'), 'permissionMode: auto\n');
    resetConfig();
    await writeWebSearchConfig({ provider: 'tavily', tavilyApiKey: 'tvly-settings' });
    expect(getConfig().webSearch).toMatchObject({
      provider: 'tavily',
      tavilyApiKey: 'tvly-settings',
    });
    await writeWebSearchConfig({ provider: 'auto' });
    expect(getConfig().webSearch).toMatchObject({
      provider: 'auto',
      tavilyApiKey: 'tvly-settings',
    });
  });

  it('labels Auto as missing a key until one is saved', () => {
    expect(webSearchSettingsView({ provider: 'auto' }, {})).toEqual({
      provider: 'auto',
      label: 'Auto · no key',
    });
    expect(webSearchSettingsView({ provider: 'tavily', tavilyApiKey: 'tvly-x' }, {})).toEqual({
      provider: 'tavily',
      label: 'Tavily',
    });
  });
});
