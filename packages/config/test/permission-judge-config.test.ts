import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getConfig, resetConfig } from '../src/config.js';
import {
  parsePermissionJudgeDecision,
  readPermissionJudgeResponseText,
  resolvePermissionJudgeCredentials,
} from '../src/permission-judge.js';
import { writePermissionJudgeConfig } from '../src/permission-judge-write.js';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(join(os.tmpdir(), 'talos-permission-judge-'));
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

describe('permission.judge config', () => {
  it('reuses a custom_provider credential', async () => {
    fs.writeFileSync(
      join(dataDir, 'config.yaml'),
      [
        'custom_provider:',
        '  work:',
        '    name: Work',
        '    options:',
        '      apiKey: sk-test',
        '      baseURL: http://127.0.0.1:9/v1',
        '    models: {}',
        '',
      ].join('\n'),
    );
    resetConfig();
    await writePermissionJudgeConfig({
      source: 'provider',
      providerId: 'custom_provider:work',
      modelId: 'gpt-test',
    });
    const creds = resolvePermissionJudgeCredentials(getConfig());
    expect(creds).toMatchObject({
      source: 'provider',
      apiKey: 'sk-test',
      baseURL: 'http://127.0.0.1:9/v1',
      model: 'gpt-test',
    });
  });

  it('stores a separate manual judge without touching custom_provider', async () => {
    fs.writeFileSync(join(dataDir, 'config.yaml'), 'permissionMode: auto\n');
    resetConfig();
    await writePermissionJudgeConfig({
      source: 'manual',
      baseURL: 'http://127.0.0.1:9/v1',
      apiKey: 'sk-deepseek',
      model: 'deepseek-chat',
    });
    expect(getConfig().custom_provider).toBeUndefined();
    expect(resolvePermissionJudgeCredentials(getConfig())).toMatchObject({
      source: 'manual',
      model: 'deepseek-chat',
      apiKey: 'sk-deepseek',
    });
  });

  it('maps judge deny/block to ask', () => {
    expect(parsePermissionJudgeDecision('{"decision":"deny","reason":"git push"}')).toEqual({
      decision: 'ask',
      reason: 'git push',
    });
    expect(parsePermissionJudgeDecision('{"decision":"block","reason":"sudo"}')).toEqual({
      decision: 'ask',
      reason: 'sudo',
    });
    expect(parsePermissionJudgeDecision('{"decision":"allow","reason":"in-workspace edit"}')).toEqual({
      decision: 'allow',
      reason: 'in-workspace edit',
    });
    expect(parsePermissionJudgeDecision('not json')).toEqual({
      decision: 'ask',
      reason: 'not json',
    });
  });

  it('refuses to reuse the managed MiniMax provider as a judge', async () => {
    fs.writeFileSync(join(dataDir, 'config.yaml'), 'permissionMode: auto\n');
    resetConfig();
    await writePermissionJudgeConfig({
      source: 'provider',
      providerId: 'minimax',
      modelId: 'MiniMax-M2.5',
    });
    expect(resolvePermissionJudgeCredentials(getConfig())).toBeUndefined();
  });

  it('reads thinking-model JSON from reasoning_content when content is empty', () => {
    expect(
      readPermissionJudgeResponseText('openai-completions', {
        choices: [
          {
            message: {
              content: '',
              reasoning_content: '{"decision":"ask","reason":"SSH private key"}',
            },
          },
        ],
      }),
    ).toBe('{"decision":"ask","reason":"SSH private key"}');
  });

  it('reads OpenAI array content parts', () => {
    expect(
      readPermissionJudgeResponseText('openai-completions', {
        choices: [
          {
            message: {
              content: [{ type: 'text', text: '{"decision":"allow","reason":"workspace read"}' }],
            },
          },
        ],
      }),
    ).toBe('{"decision":"allow","reason":"workspace read"}');
  });
});
