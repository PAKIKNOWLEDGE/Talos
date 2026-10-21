import { describe, expect, it, vi } from 'vitest';
import { TuiSettingsPicker } from '../../src/tui/features/settings/picker.js';
import { stripAnsi } from '../../src/tui/rendering/text.js';
import {
  collapsalStatusDiamond,
  defaultThemeIdForTuiSkin,
  parseTuiSkin,
  tuiSkinRestartHint,
} from '../../src/tui/skin.js';

describe('TUI skin', () => {
  it('falls back to classic for unknown values', () => {
    expect(parseTuiSkin(undefined)).toBe('classic');
    expect(parseTuiSkin('grok')).toBe('classic');
    expect(parseTuiSkin('collapsal')).toBe('collapsal');
    expect(defaultThemeIdForTuiSkin('classic')).toBeUndefined();
    expect(defaultThemeIdForTuiSkin('collapsal')).toBe('collapsal');
  });

  it('maps Collapsal diamonds onto theme color tokens', () => {
    const colors = {
      muted: '#muted',
      success: '#success',
      warning: '#warning',
      error: '#error',
    };
    expect(collapsalStatusDiamond('running', colors)).toEqual({ glyph: '◇', color: '#muted' });
    expect(collapsalStatusDiamond('succeeded', colors)).toEqual({ glyph: '◆', color: '#success' });
    expect(collapsalStatusDiamond('failed', colors)).toEqual({ glyph: '◆', color: '#error' });
    expect(tuiSkinRestartHint('collapsal')).toBe(
      'Restart Talos to apply the Collapsal interface.',
    );
  });

  it('saves a Collapsal selection from the Interface page', () => {
    const onSkinChange = vi.fn(() => true);
    const onClose = vi.fn();
    const picker = new TuiSettingsPicker('regular', vi.fn(() => true), onClose, undefined, vi.fn(), {
      currentSkin: 'classic',
      onSkinChange,
    });

    expect(stripAnsi(picker.render(80).join('\n'))).toContain('Interface');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');
    expect(stripAnsi(picker.render(80).join('\n'))).toContain('Collapsal');
    picker.handleInput('\u001b[B');
    picker.handleInput('\r');

    expect(onSkinChange).toHaveBeenCalledWith('collapsal');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
