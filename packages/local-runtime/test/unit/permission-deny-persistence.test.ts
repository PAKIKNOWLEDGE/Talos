import { describe, expect, it, vi } from 'vitest';

import { formatBlockedToolReason } from '@mavis/permission';

import { LocalPermissionApprovalService } from '../../src/api/local-permission-approval-service.js';
import { requestLocalPermissionApproval } from '../../src/api/routes/permissions.js';

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
    await expect(allowed.promise).resolves.toBe('allowAlways');
    expect(approval.takeDenialGuidance(allowed.requestId)).toBeUndefined();
    expect(applyUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'addRules',
        behavior: 'allow',
        source: 'global',
        rules: [{ tool_name: 'bash', rule_content: '*' }],
      }),
    );
  });

  it('keeps a typed denial reason for the tool result and does not keep it for allow', async () => {
    const approval = new LocalPermissionApprovalService({
      agentName: 'talos',
      nowMs: () => 1,
      permissionRules: { applyUpdate: vi.fn(async () => undefined) } as never,
      publishGlobalEvent: () => undefined,
    });
    const denied = approval.begin({
      sessionId: 'session-1',
      agentName: 'talos',
      turnId: 'turn-1',
      toolName: 'write',
      ruleContents: [],
      persistWholeToolRuleOnReply: true,
      reason: 'outside the workspace',
    });
    await approval.reply([denied.requestId], 'deny', '  use src/probe.txt  ');
    await expect(denied.promise).resolves.toBe('deny');
    expect(approval.takeDenialGuidance(denied.requestId)).toBe('use src/probe.txt');
    expect(approval.takeDenialGuidance(denied.requestId)).toBeUndefined();
    expect(
      formatBlockedToolReason({
        source: 'user',
        toolName: 'write',
        trigger: 'outside the workspace',
        guidance: 'use src/probe.txt',
      }),
    ).toBe(
      '[permission:denied source=user] User rejected the `write` call in the confirmation dialog. Trigger: outside the workspace Guidance: use src/probe.txt',
    );
  });

  it('returns typed deny guidance from the hosted approval port without putting it in the rule', async () => {
    const applyUpdate = vi.fn(async () => undefined);
    const approval = new LocalPermissionApprovalService({
      agentName: 'talos',
      nowMs: () => 1,
      permissionRules: { applyUpdate } as never,
      publishGlobalEvent: () => undefined,
    });
    const pending = requestLocalPermissionApproval(
      { approvalService: approval } as never,
      {
        sessionId: 'session-1',
        agentName: 'talos',
        turnId: 'turn-1',
        toolName: 'write',
        ruleContents: ['C:\\Users\\pachu77\\Documents\\probe.txt'],
        persistWholeToolRuleOnReply: true,
        reason: 'Needs confirmation: outside the workspace',
      },
    );
    const requestId = approval.listPending()[0]?.requestId;
    expect(requestId).toEqual(expect.any(String));
    await approval.reply([requestId!], 'deny', '  NO_WRITE_DOCS_7f3a  ');

    await expect(pending).resolves.toEqual({
      decision: 'deny',
      guidance: 'NO_WRITE_DOCS_7f3a',
    });
    expect(approval.takeDenialGuidance(requestId!)).toBeUndefined();
    expect(JSON.stringify(applyUpdate.mock.calls)).not.toContain('NO_WRITE_DOCS_7f3a');
  });
});
