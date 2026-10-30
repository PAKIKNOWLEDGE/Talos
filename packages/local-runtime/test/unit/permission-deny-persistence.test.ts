import { describe, expect, it, vi } from 'vitest';

import { LocalPermissionApprovalService } from '../../src/api/local-permission-approval-service.js';

describe('permission deny persistence', () => {
  it('does not save a whole-tool deny when the ask has no narrower rule', async () => {
    const applyUpdate = vi.fn(async () => undefined);
    const approval = new LocalPermissionApprovalService({
      agentName: 'talos',
      nowMs: () => 1,
      permissionRules: { applyUpdate } as never,
      publishGlobalEvent: () => undefined,
    });
    const pending = approval.begin({
      sessionId: 'session-1',
      agentName: 'talos',
      turnId: 'turn-1',
      toolName: 'bash',
      ruleContents: [],
      persistWholeToolRuleOnReply: true,
      reason: 'classifier asked',
    });

    await approval.reply([pending.requestId], 'deny');

    expect(applyUpdate).not.toHaveBeenCalled();
    await expect(pending.promise).resolves.toBe('deny');
  });

  it('saves a scoped deny and still saves allow-always for the whole tool', async () => {
    const applyUpdate = vi.fn(async () => undefined);
    const approval = new LocalPermissionApprovalService({
      agentName: 'talos',
      nowMs: () => 1,
      permissionRules: { applyUpdate } as never,
      publishGlobalEvent: () => undefined,
    });
    const denied = approval.begin({
      sessionId: 'session-1',
      agentName: 'talos',
      turnId: 'turn-1',
      toolName: 'bash',
      ruleContents: ['npm publish', '*'],
      persistWholeToolRuleOnReply: true,
      reason: 'classifier asked',
    });
    await approval.reply([denied.requestId], 'deny');
    expect(applyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'addRules',
        behavior: 'deny',
        source: 'session',
        rules: [{ tool_name: 'bash', rule_content: 'npm publish' }],
      }),
    );

    const allowed = approval.begin({
      sessionId: 'session-1',
      agentName: 'talos',
      turnId: 'turn-2',
      toolName: 'bash',
      ruleContents: [],
      persistWholeToolRuleOnReply: true,
      reason: 'classifier asked',
    });
    await approval.reply([allowed.requestId], 'allowAlways');
    expect(applyUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'addRules',
        behavior: 'allow',
        source: 'global',
        rules: [{ tool_name: 'bash', rule_content: '*' }],
      }),
    );
  });
});
