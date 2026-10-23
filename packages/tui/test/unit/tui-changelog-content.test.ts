import { describe, expect, it } from 'vitest';

import {
  extractTuiVersionChangelogEntries,
  readPackagedTuiChangelog,
} from '../../src/tui/features/changelog/content.js';

describe('Talos welcome changelog', () => {
  it('uses the first heading when the same version appears twice', () => {
    const source = [
      '## 0.1.5 · 2026-10-19',
      '',
      '- Opening screen shows this release.',
      '- SOCKS proxies no longer abort startup.',
      '- Selected models survive /new.',
      '',
      '## 0.1.5 · 2026-08-01',
      '',
      '- Stale upstream note that must not win.',
    ].join('\n');
    const entries = extractTuiVersionChangelogEntries(source, '0.1.5');
    expect(entries[0]).toBe('Opening screen shows this release.');
    expect(entries.join('\n')).not.toContain('Stale upstream note');
  });

  it('reads the packaged English notes for 0.1.9', () => {
    const source = readPackagedTuiChangelog('en-US');
    expect(source).toBeTruthy();
    const entries = extractTuiVersionChangelogEntries(source ?? '', '0.1.9');
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.join('\n')).toContain('Collapsal');
    expect(entries.join('\n')).toContain('Classic');
    expect(entries.join('\n')).toContain('boot sound');
    expect(entries.join('\n')).toContain('Full access');
    expect(entries.join('\n')).not.toContain('mcode plugin');
  });

  it('reads the packaged Chinese notes for 0.1.9', () => {
    const source = readPackagedTuiChangelog('zh-CN');
    expect(source).toBeTruthy();
    const entries = extractTuiVersionChangelogEntries(source ?? '', '0.1.9');
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.join('\n')).toContain('Collapsal');
    expect(entries.join('\n')).toContain('Classic');
    expect(entries.join('\n')).toContain('音效');
    expect(entries.join('\n')).toContain('权限');
  });
});
