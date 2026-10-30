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
});
