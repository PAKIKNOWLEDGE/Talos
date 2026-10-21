import { visibleWidth } from '../../rendering/text.js';
import { DEFAULT_TUI_SKIN, type TuiSkin } from '../../skin.js';
import { tuiChalk as chalk, tuiColors as colors } from '../../theme/runtime.js';
import { centerToWidth } from '../frame.js';
import { collapsalWelcomeArt } from './collapsal-art.js';
import {
  TALOS_TERMINAL_ASCII_WORDMARK,
  TALOS_TERMINAL_EMBLEM,
  TALOS_TERMINAL_EMBLEM_MICRO,
  TALOS_WELCOME_DESIGN,
} from './design.js';

export function renderTuiWelcomeHero(width: number, skin: TuiSkin = DEFAULT_TUI_SKIN): string[] {
  return skin === 'collapsal' ? renderCollapsalHero(width) : renderClassicHero(width);
}

function renderClassicHero(width: number): string[] {
  const { fullMinWidth, mediumMinWidth, microMinWidth, fallbackTitle } = TALOS_WELCOME_DESIGN.hero;
  const emblem =
    width >= fullMinWidth
      ? TALOS_TERMINAL_EMBLEM
      : width >= mediumMinWidth
        ? TALOS_TERMINAL_EMBLEM
        : width >= microMinWidth
          ? TALOS_TERMINAL_EMBLEM_MICRO
          : [fallbackTitle];
  const source =
    width >= fullMinWidth
      ? renderFullHero()
      : width >= mediumMinWidth
        ? ['TALOS', '', ...emblem]
        : emblem;
  const sourceWidth = Math.max(...source.map((line) => visibleWidth(line)));
  const wordmarkRowCount = width >= fullMinWidth ? TALOS_TERMINAL_ASCII_WORDMARK.length : 0;
  const wordmarkGradient = [
    colors.wordmarkHighlight,
    colors.wordmarkHighlight,
    colors.brand,
    colors.brand,
    colors.wordmarkShadow,
    colors.wordmarkShadow,
  ];

  return source.map((line, index) => {
    const canvasLine = line + ' '.repeat(Math.max(0, sourceWidth - visibleWidth(line)));
    const color = index < wordmarkRowCount ? wordmarkGradient[index] : colors.warning;
    return centerToWidth(chalk.bold.hex(color)(canvasLine), width);
  });
}

function renderCollapsalHero(width: number): string[] {
  const source = collapsalWelcomeArt(width);
  const sourceWidth = Math.max(...source.map((line) => visibleWidth(line)));
  return source.map((line) => {
    const canvasLine = line + ' '.repeat(Math.max(0, sourceWidth - visibleWidth(line)));
    return centerToWidth(chalk.bold.hex(colors.brand)(canvasLine), width);
  });
}

function renderFullHero(): string[] {
  const emblemWidth = Math.max(...TALOS_TERMINAL_EMBLEM.map((line) => visibleWidth(line)));

  return TALOS_TERMINAL_ASCII_WORDMARK.map((line, index) => {
    const emblem = TALOS_TERMINAL_EMBLEM[index] ?? '';
    return `${line}${' '.repeat(4)}${emblem}${' '.repeat(Math.max(0, emblemWidth - visibleWidth(emblem)))}`;
  });
}
