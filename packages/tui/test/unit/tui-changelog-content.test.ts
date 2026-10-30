import { describe, expect, it } from 'vitest';

import {
  extractTuiVersionChangelogEntries,
  readPackagedTuiChangelog,
  selectWelcomeChangelogEntries,
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

  it('keeps welcome notes in changelog order', () => {
    expect(
      selectWelcomeChangelogEntries(['session wipe', 'system notes', 'web search', 'boot sound'], 3),
    ).toEqual(['session wipe', 'system notes', 'web search']);
  });

  it('reads the packaged English notes for 0.1.12', () => {
    const source = readPackagedTuiChangelog('en-US');
    expect(source).toBeTruthy();
    const entries = extractTuiVersionChangelogEntries(source ?? '', '0.1.12');
    expect(entries[0]).toContain('changelog order');
    expect(entries[0]).toContain('random');
    expect(entries[1]).toContain('/rules');
    expect(entries[2]).toContain('Deny and guide');
    expect(selectWelcomeChangelogEntries(entries)).toEqual(entries.slice(0, 3));
  });

  it('reads the packaged Chinese notes for 0.1.12', () => {
    const source = readPackagedTuiChangelog('zh-CN');
    expect(source).toBeTruthy();
    const entries = extractTuiVersionChangelogEntries(source ?? '', '0.1.12');
    expect(entries[0]).toContain('不再随机');
    expect(entries[1]).toContain('/rules');
    expect(selectWelcomeChangelogEntries(entries)).toEqual(entries.slice(0, 3));
  });

  it('reads the packaged English notes for 0.1.11', () => {
    const source = readPackagedTuiChangelog('en-US');
    expect(source).toBeTruthy();
    const entries = extractTuiVersionChangelogEntries(source ?? '', '0.1.11');
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.join('\n')).toContain('System notes');
    expect(entries.join('\n')).toContain('Ctrl+X');
    expect(entries.join('\n')).toContain('Ctrl+D');
    expect(entries.join('\n')).toContain('Web search');
    expect(entries.join('\n')).toContain('Tavily');
    expect(entries.join('\n')).toContain('/settings');
    expect(entries.join('\n')).toContain('Collapsal');
    expect(entries.join('\n')).toContain('Classic');
    expect(entries.join('\n')).toContain('boot sound');
    expect(entries.join('\n')).toContain('Full access');
    expect(entries.join('\n')).not.toContain('mcode plugin');
  });

  it('reads the packaged Chinese notes for 0.1.11', () => {
    const source = readPackagedTuiChangelog('zh-CN');
    expect(source).toBeTruthy();
    const entries = extractTuiVersionChangelogEntries(source ?? '', '0.1.11');
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.join('\n')).toContain('系统说明');
    expect(entries.join('\n')).toContain('Ctrl+X');
    expect(entries.join('\n')).toContain('Ctrl+D');
    expect(entries.join('\n')).toContain('Web search');
    expect(entries.join('\n')).toContain('Tavily');
    expect(entries.join('\n')).toContain('/settings');
    expect(entries.join('\n')).toContain('Collapsal');
    expect(entries.join('\n')).toContain('Classic');
    expect(entries.join('\n')).toContain('音效');
    expect(entries.join('\n')).toContain('权限');
  });
});
