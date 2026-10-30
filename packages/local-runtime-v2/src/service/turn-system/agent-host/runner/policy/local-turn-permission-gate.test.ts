import { describe, expect, it } from 'vitest';

import { LocalTurnPermissionGate } from './local-turn-permission-gate.js';

const JUDGE_REASON =
  'Needs confirmation: 该操作会写入工作区外的精确文件，但用户近期消息仅要求重测，未直接指定该文件路径。';

function gate(approval: 'deny' | { decision: 'deny'; guidance?: string }) {
  return new LocalTurnPermissionGate({
    enforceBuiltinTools: true,
    decisions: {
      check: async () => ({ behavior: 'ask', reason: JUDGE_REASON }),
    },
    approval: { request: async () => approval },
  });
}

function writeCall() {
  return {
    sessionId: 'session-1',
    turnId: 'turn-1',
    agentName: 'talos',
    model: 'model',
    toolContext: {
      toolCall: { id: 'call-1', name: 'write', source: 'builtin' },
      args: { path: 'C:\\Users\\pachu77\\Documents\\talos-deny-guidance-probe.txt' },
    },
  } as never;
}

describe('local turn permission gate deny guidance', () => {
  it('appends the typed deny reason to the user denial the model reads', async () => {
    const blocked = await gate({
      decision: 'deny',
      guidance: 'NO_WRITE_DOCS_7f3a',
    }).beforeToolCall(writeCall());

    expect(blocked).toEqual({
      block: true,
      blockedBy: 'permission',
      reason: `Permission denied by user for write: ${JUDGE_REASON} Guidance: NO_WRITE_DOCS_7f3a`,
    });
  });

  it('keeps a bare deny free of a guidance suffix', async () => {
    const blocked = await gate('deny').beforeToolCall(writeCall());

    expect(blocked?.reason).toBe(`Permission denied by user for write: ${JUDGE_REASON}`);
  });
});
