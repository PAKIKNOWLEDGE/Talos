import { stripVTControlCharacters } from 'node:util';
import { describe, expect, it, vi } from 'vitest';

import { TuiPermissionRulesPanel } from '../../src/tui/features/interaction/permission-rules-panel.js';
import type { TuiSavedPermissionRule } from '../../src/runtime/port.js';

const deny: TuiSavedPermissionRule = {
  source: 'session',
  destination: 'session-1',
  behavior: 'deny',
  toolName: 'bash',
  ruleContent: '*',
  matcher: { kind: 'command', pattern: '*' },
};

describe('saved permission rules panel', () => {
  it('deletes only the selected rule', async () => {
    const onDelete = vi.fn(async () => undefined);
    const panel = new TuiPermissionRulesPanel({
      rules: [
        deny,
        {
          source: 'global',
          destination: 'global',
          behavior: 'allow',
          toolName: 'fs',
          matcher: { kind: 'path', pattern: 'src/**' },
        },
      ],
      onDelete,
      onCancel: vi.fn(),
      requestRender: vi.fn(),
    });

    const before = stripVTControlCharacters(panel.render(80).join('\n'));
    expect(before).toContain('deny · bash · * · session');
    expect(before).toContain('d delete');

    panel.handleInput('d');
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledWith(deny));
    expect(stripVTControlCharacters(panel.render(80).join('\n'))).not.toContain('deny · bash');
    expect(stripVTControlCharacters(panel.render(80).join('\n'))).toContain('allow · fs · src/** · global');
  });

  it('scrolls the list so the selected rule stays on screen', () => {
    const rules = Array.from({ length: 12 }, (_, index) => ({
      source: 'global' as const,
      destination: 'global',
      behavior: 'allow' as const,
      toolName: 'bash',
      matcher: { kind: 'command' as const, pattern: `rule-${index}` },
    }));
    const panel = new TuiPermissionRulesPanel({
      rules,
      onDelete: vi.fn(async () => undefined),
      onCancel: vi.fn(),
      requestRender: vi.fn(),
    });

    const plain = () => stripVTControlCharacters(panel.renderViewport(80, 10).join('\n'));
    expect(plain()).toContain('rule-0');
    expect(plain()).not.toContain('rule-11');

    for (let step = 0; step < 11; step += 1) panel.handleInput('\x1b[B');
    const scrolled = plain();
    expect(scrolled).toContain('12/12');
    expect(scrolled).toContain('› allow · bash · rule-11 · global');
    expect(scrolled).not.toContain('rule-0');

    for (let step = 0; step < 11; step += 1) panel.handleInput('\x1b[A');
    const back = plain();
    expect(back).toContain('1/12');
    expect(back).toContain('› allow · bash · rule-0 · global');
    expect(back).not.toContain('rule-11');
  });
});
