import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import { resetConfig } from '@mavis/config';
import { TuiSettingsPicker } from '../../src/tui/features/settings/picker.js';
import { stripAnsi } from '../../src/tui/rendering/text.js';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(join(os.tmpdir(), 'talos-tui-judge-settings-'));
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

describe('TuiSettingsPicker LLM judge entry', () => {
  it('opens a dedicated judge page from Settings instead of mixing it into TUI mode', () => {
    const picker = new TuiSettingsPicker(
      'regular',
      vi.fn(() => true),
      vi.fn(),
      { listReusableModels: async () => [] },
      vi.fn(),
    );
    const menu = stripAnsi(picker.render(80).join('\n'));
    expect(menu).toContain('LLM judge');
    expect(menu).toContain('Terminal appearance');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');
    const judge = stripAnsi(picker.render(80).join('\n'));
    expect(judge).toContain('Reuse');
    expect(judge).toContain('Enter a separate judge');
    expect(judge).not.toContain('Fullscreen');
  });
});
