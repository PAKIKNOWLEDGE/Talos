import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

import { getConfig, resetConfig } from '@mavis/config';
import { TuiSettingsPicker } from '../../src/tui/features/settings/picker.js';
import { stripAnsi } from '../../src/tui/rendering/text.js';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(join(os.tmpdir(), 'talos-tui-web-search-settings-'));
  vi.stubEnv('MINIMAX_DATA_DIR', dataDir);
  vi.stubEnv('__MAVIS_RUNTIME_DATA_DIR', dataDir);
  vi.stubEnv('__MAVIS_RUNTIME_DISABLE_GIT_AUTO_CONFIG', '1');
  fs.writeFileSync(join(dataDir, 'config.yaml'), 'permissionMode: auto\n');
  resetConfig();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfig();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('TuiSettingsPicker web search entry', () => {
  it('opens Web search from Settings and lists backends', () => {
    const picker = new TuiSettingsPicker(
      'regular',
      vi.fn(() => true),
      vi.fn(),
      { listReusableModels: async () => [] },
      vi.fn(),
    );
    const menu = stripAnsi(picker.render(80).join('\n'));
    expect(menu).toContain('Web search');
    expect(menu).toContain('Auto · no key');
    picker.handleInput('\u001b[B');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');
    const page = stripAnsi(picker.render(80).join('\n'));
    expect(page).toContain('Choose the backend for web_search');
    expect(page).toContain('Tavily');
    expect(page).toContain('Exa');
    expect(page).toContain('DeepSeek');
    expect(page).toContain('Edit API keys');
    expect(page).not.toContain('Fullscreen');
  });

  it('saves an explicit Tavily backend after entering a key', async () => {
    const picker = new TuiSettingsPicker(
      'regular',
      vi.fn(() => true),
      vi.fn(),
      { listReusableModels: async () => [] },
      vi.fn(),
    );
    picker.handleInput('\u001b[B');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');
    expect(stripAnsi(picker.render(80).join('\n'))).toContain('Tavily API key');
    picker.handleInput('\r');
    picker.handleInput('tvly-from-tui');
    picker.handleInput('\r');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');
    await vi.waitFor(() => {
      expect(getConfig().webSearch).toMatchObject({
        provider: 'tavily',
        tavilyApiKey: 'tvly-from-tui',
      });
    });
  });
});
