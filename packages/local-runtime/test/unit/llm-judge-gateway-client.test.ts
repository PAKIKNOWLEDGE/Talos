import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetConfig } from '@mavis/config';
import {
  LlmJudgeGatewayClient,
  PERMISSION_JUDGE_SYSTEM_PROMPT,
} from '../../src/permissions/llm-judge-gateway-client.js';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(join(os.tmpdir(), 'talos-llm-judge-client-'));
  vi.stubEnv('MINIMAX_DATA_DIR', dataDir);
  vi.stubEnv('__MAVIS_RUNTIME_DATA_DIR', dataDir);
  vi.stubEnv('__MAVIS_RUNTIME_DISABLE_GIT_AUTO_CONFIG', '1');
  resetConfig();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetConfig();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const request = {
  toolName: 'bash',
  input: '{"command":"git push"}',
  platform: 'win32',
  homeDir: '/synthetic/home',
  workspaceRoot: '/synthetic/workspace',
  mode: 'auto' as const,
  conversationContext: '',
};

describe('LlmJudgeGatewayClient', () => {
  it('fail-closes to ask when no judge is configured', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network should not run');
    });
    const client = new LlmJudgeGatewayClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const verdict = await client.classify(request);
    expect(verdict.kind).toBe('timeout');
    expect(verdict.reasonLocalized).toContain('/settings');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a judge ask JSON verdict to confirm', async () => {
    fs.writeFileSync(
      join(dataDir, 'config.yaml'),
      [
        'permission:',
        '  judge:',
        '    source: manual',
        '    baseURL: http://127.0.0.1:9/v1',
        '    apiKey: sk-test',
        '    model: judge-model',
        '',
      ].join('\n'),
    );
    resetConfig();
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"decision":"ask","reason":"push requires a person"}' } }],
      }),
    );
    const client = new LlmJudgeGatewayClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.classify(request)).resolves.toMatchObject({
      kind: 'confirm',
      reasonLocalized: 'push requires a person',
    });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('127.0.0.1');
  });

  it('reads a thinking-model JSON verdict from reasoning_content', async () => {
    fs.writeFileSync(
      join(dataDir, 'config.yaml'),
      [
        'permission:',
        '  judge:',
        '    source: manual',
        '    baseURL: http://127.0.0.1:9/v1',
        '    apiKey: sk-test',
        '    model: mimo-v2.6-flash',
        '',
      ].join('\n'),
    );
    resetConfig();
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: '',
              reasoning_content: '{"decision":"ask","reason":"SSH private key"}',
            },
          },
        ],
      }),
    );
    const client = new LlmJudgeGatewayClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.classify(request)).resolves.toMatchObject({
      kind: 'confirm',
      reasonLocalized: 'SSH private key',
    });
  });

  it('asks without calling it a timeout when the completion is empty', async () => {
    fs.writeFileSync(
      join(dataDir, 'config.yaml'),
      [
        'permission:',
        '  judge:',
        '    source: manual',
        '    baseURL: http://127.0.0.1:9/v1',
        '    apiKey: sk-test',
        '    model: judge-model',
        '',
      ].join('\n'),
    );
    resetConfig();
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '' } }],
      }),
    );
    const client = new LlmJudgeGatewayClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const verdict = await client.classify(request);
    expect(verdict.kind).toBe('confirm');
    expect(verdict.reasonLocalized).toBe('Judge returned an empty completion');
  });

  it('maps AbortError to timeout', async () => {
    fs.writeFileSync(
      join(dataDir, 'config.yaml'),
      [
        'permission:',
        '  judge:',
        '    source: manual',
        '    baseURL: http://127.0.0.1:9/v1',
        '    apiKey: sk-test',
        '    model: judge-model',
        '',
      ].join('\n'),
    );
    resetConfig();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('The operation was aborted.', 'TimeoutError');
    });
    const client = new LlmJudgeGatewayClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.classify(request)).resolves.toMatchObject({
      kind: 'timeout',
      reasonLocalized: 'The operation was aborted.',
    });
  });

  it('follows Claude HARD/SOFT policy: ordinary reads allow, outside writes ask', () => {
    expect(PERMISSION_JUDGE_SYSTEM_PROMPT).toContain('HARD ASK');
    expect(PERMISSION_JUDGE_SYSTEM_PROMPT).toContain('SOFT ASK');
    expect(PERMISSION_JUDGE_SYSTEM_PROMPT).toContain(
      'ordinary reads and searches (including outside the workspace, unless they hit HARD)',
    );
    expect(PERMISSION_JUDGE_SYSTEM_PROMPT).toContain(
      'file writes or edits outside the workspace',
    );
    expect(PERMISSION_JUDGE_SYSTEM_PROMPT).toContain(
      'reading or exporting secrets, credentials, private keys, or .env files',
    );
    expect(PERMISSION_JUDGE_SYSTEM_PROMPT).not.toContain(
      'ASK for confirmation when the action is destructive, leaves the workspace',
    );
  });

  it('sends inWorkspace facts for path tools', async () => {
    fs.writeFileSync(
      join(dataDir, 'config.yaml'),
      [
        'permission:',
        '  judge:',
        '    source: manual',
        '    baseURL: http://127.0.0.1:9/v1',
        '    apiKey: sk-test',
        '    model: judge-model',
        '',
      ].join('\n'),
    );
    resetConfig();
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"decision":"allow","reason":"ordinary read"}' } }],
      }),
    );
    const client = new LlmJudgeGatewayClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.classify({
      ...request,
      toolName: 'read',
      input: join(os.tmpdir(), 'outside-win.ini'),
      workspaceRoot: join(os.tmpdir(), 'talos-ws'),
      homeDir: join(os.tmpdir(), 'home'),
    });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0]?.content).toContain('HARD ASK');
    expect(body.messages[1]?.content).toContain('resolvedPath:');
    expect(body.messages[1]?.content).toContain('inWorkspace: false');
  });
});
