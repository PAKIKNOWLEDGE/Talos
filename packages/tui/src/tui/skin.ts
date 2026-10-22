/**
 * Boot-frozen TUI skin. Color themes (`/theme`) still live-preview palettes;
 * a skin change is persisted and takes effect on the next process start so
 * welcome art, tool chrome, and activity presentation stay consistent.
 */
export const TUI_SKINS = ['classic', 'collapsal'] as const;
export type TuiSkin = (typeof TUI_SKINS)[number];
export const DEFAULT_TUI_SKIN: TuiSkin = 'classic';
/** Boot default `/theme` id when the Collapsal skin is on and no theme is saved. */
export const COLLAPSAL_DEFAULT_THEME_ID = 'collapsal';

export function defaultThemeIdForTuiSkin(skin: TuiSkin): string | undefined {
  return skin === 'collapsal' ? COLLAPSAL_DEFAULT_THEME_ID : undefined;
}

export function isTuiSkin(value: unknown): value is TuiSkin {
  return value === 'classic' || value === 'collapsal';
}

export function parseTuiSkin(value: unknown): TuiSkin {
  return isTuiSkin(value) ? value : DEFAULT_TUI_SKIN;
}

export const TUI_SKIN_LABELS: Record<TuiSkin, string> = {
  classic: 'Classic',
  collapsal: 'Collapsal',
};

export const TUI_SKIN_DESCRIPTIONS: Record<TuiSkin, string> = {
  classic: 'Default Talos layout, welcome art, and tool chrome.',
  collapsal:
    'Framed welcome, closed editor, user bubbles, compact chrome. Applies after restart.',
};

export function tuiSkinRestartHint(skin: TuiSkin): string {
  return `Restart Talos to apply the ${TUI_SKIN_LABELS[skin]} interface.`;
}

/** Theme-token inputs for Collapsal status diamonds. */
export interface CollapsalDiamondColors {
  readonly muted: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
}

/**
 * Collapsal status diamonds. Glyphs are fixed; colors always come from the
 * active theme contract so `/theme` still recolors the skin.
 */
export function collapsalStatusDiamond(
  status: 'running' | 'succeeded' | 'failed' | 'mixed',
  colors: CollapsalDiamondColors,
): { readonly glyph: string; readonly color: string } {
  if (status === 'running') return { glyph: '◇', color: colors.muted };
  if (status === 'failed') return { glyph: '◆', color: colors.error };
  if (status === 'mixed') return { glyph: '◆', color: colors.warning };
  return { glyph: '◆', color: colors.success };
}

/**
 * Non-bobbing braille spinner: seven of eight dots lit, rotating the gap so
 * the optical center does not travel. Frame set described in
 * lawrencewzen/pi-grok-tui (MIT).
 */
export const COLLAPSAL_SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'] as const;
