import { getConfig, permissionJudgeView } from '@mavis/config';
import { getKeybindings, type TuiMode } from '../../engine/public.js';
import type { Component } from '../../rendering/component.js';
import { truncateToWidth, visibleWidth } from '../../rendering/text.js';
import { tuiChalk as chalk, tuiColors as colors } from '../../theme/runtime.js';
import {
  questionnaireFrameContentWidth,
  renderQuestionnaireFrame,
} from '../interaction/decision-frame.js';
import { TuiJudgeSettings, type TuiJudgeSettingsPort } from './judge-picker.js';

const TUI_MODES = ['regular', 'fullscreen'] as const satisfies readonly TuiMode[];

const TUI_MODE_DESCRIPTIONS: Record<TuiMode, string> = {
  regular: 'Uses terminal scrollback, selection, and copy.',
  fullscreen: 'Keeps Talos in a fixed viewport with in-app scrolling.',
};

type SettingsPage = 'menu' | 'terminal' | 'judge';

export class TuiSettingsPicker implements Component {
  private page: SettingsPage = 'menu';
  private menuIndex = 0;
  private terminalIndex: number;
  private judgePage: TuiJudgeSettings | undefined;

  constructor(
    private currentMode: TuiMode,
    private readonly onTuiModeChange: (mode: TuiMode) => boolean,
    private readonly onClose: () => void,
    private readonly judgePort?: TuiJudgeSettingsPort,
    private readonly requestRender: () => void = () => undefined,
  ) {
    this.terminalIndex = Math.max(0, TUI_MODES.indexOf(currentMode));
  }

  handleInput(data: string): void {
    const keybindings = getKeybindings();
    if (this.page === 'judge') {
      this.judgePage?.handleInput(data);
      return;
    }
    if (this.page === 'terminal') {
      this.handleTerminalInput(data, keybindings);
      return;
    }
    if (keybindings.matches(data, 'tui.select.up')) {
      this.menuIndex = this.menuIndex === 0 ? 1 : 0;
      return;
    }
    if (keybindings.matches(data, 'tui.select.down')) {
      this.menuIndex = (this.menuIndex + 1) % 2;
      return;
    }
    if (keybindings.matches(data, 'tui.select.confirm')) {
      if (this.menuIndex === 0) {
        this.page = 'terminal';
        this.terminalIndex = Math.max(0, TUI_MODES.indexOf(this.currentMode));
      } else {
        this.openJudge();
      }
      return;
    }
    if (keybindings.matches(data, 'tui.select.cancel')) this.onClose();
  }

  invalidate(): void {
    this.judgePage?.invalidate();
  }

  render(width: number): string[] {
    if (this.page === 'judge' && this.judgePage) return this.judgePage.render(width);
    if (this.page === 'terminal') return this.renderTerminal(width);
    return this.renderMenu(width);
  }

  private openJudge(): void {
    if (!this.judgePort) {
      this.page = 'judge';
      return;
    }
    this.judgePage = new TuiJudgeSettings(
      this.judgePort,
      () => {
        this.page = 'menu';
        this.judgePage = undefined;
        this.requestRender();
      },
      this.requestRender,
    );
    this.page = 'judge';
  }

  private handleTerminalInput(
    data: string,
    keybindings: ReturnType<typeof getKeybindings>,
  ): void {
    if (keybindings.matches(data, 'tui.select.up')) {
      this.terminalIndex = this.terminalIndex === 0 ? TUI_MODES.length - 1 : this.terminalIndex - 1;
      return;
    }
    if (keybindings.matches(data, 'tui.select.down')) {
      this.terminalIndex = (this.terminalIndex + 1) % TUI_MODES.length;
      return;
    }
    if (keybindings.matches(data, 'tui.select.confirm')) {
      const selectedMode = TUI_MODES[this.terminalIndex];
      if (!selectedMode || selectedMode === this.currentMode) {
        this.onClose();
        return;
      }
      if (this.onTuiModeChange(selectedMode)) {
        this.currentMode = selectedMode;
        this.onClose();
      } else {
        this.terminalIndex = TUI_MODES.indexOf(this.currentMode);
      }
      return;
    }
    if (keybindings.matches(data, 'tui.select.cancel')) this.page = 'menu';
  }

  private renderMenu(width: number): string[] {
    const safeWidth = Math.max(0, Math.floor(width));
    if (safeWidth === 0) return [];
    const contentWidth = questionnaireFrameContentWidth(safeWidth);
    const judgeLabel = readJudgeLabel();
    const items = [
      { label: 'Terminal appearance', value: formatTuiMode(this.currentMode) },
      { label: 'LLM judge', value: judgeLabel },
    ];
    return renderQuestionnaireFrame(
      {
        title: 'Settings',
        meta: 'Options',
        body: [
          chalk.hex(colors.muted)('Choose a settings page.'),
          '',
          ...items.flatMap((item, index) => {
            const prefix = index === this.menuIndex ? chalk.bold.hex(colors.signal)('›') : ' ';
            const label = (index === this.menuIndex ? chalk.bold.hex(colors.signal) : chalk.hex(colors.text))(
              item.label.padEnd(22),
            );
            const value = chalk.hex(colors.muted)(truncateToWidth(item.value, Math.max(8, contentWidth - 26), ''));
            return [`${prefix} ${label} ${value}`];
          }),
        ],
        footer: '↑/↓ select · Enter open · Esc close',
      },
      safeWidth,
      'signal',
    );
  }

  private renderTerminal(width: number): string[] {
    const safeWidth = Math.max(0, Math.floor(width));
    if (safeWidth === 0) return [];
    const contentWidth = questionnaireFrameContentWidth(safeWidth);
    const compact = contentWidth < 56;
    const currentMode = formatTuiMode(this.currentMode);
    return renderQuestionnaireFrame(
      {
        title: safeWidth < 42 ? `Settings · ${currentMode}` : 'Settings',
        ...(safeWidth >= 42 ? { meta: `TUI mode · ${currentMode}` } : {}),
        body: [
          chalk.hex(colors.muted)(
            compact
              ? 'Choose how Talos fills this terminal.'
              : 'Choose how Talos uses this terminal.',
          ),
          '',
          ...TUI_MODES.flatMap((mode, index) =>
            renderMode(mode, {
              active: mode === this.currentMode,
              focused: index === this.terminalIndex,
              compact,
              width: contentWidth,
            }),
          ),
        ],
        footer:
          safeWidth < 42 ? '↑/↓ move · Enter · Esc back' : '↑/↓ select · Enter apply · Esc back',
      },
      safeWidth,
      'signal',
    );
  }
}

function renderMode(
  mode: TuiMode,
  options: {
    readonly active: boolean;
    readonly focused: boolean;
    readonly compact: boolean;
    readonly width: number;
  },
): string[] {
  const prefix = options.focused ? chalk.bold.hex(colors.signal)('›') : ' ';
  const label = (options.focused ? chalk.bold.hex(colors.signal) : chalk.hex(colors.text))(
    formatTuiMode(mode).padEnd(10),
  );
  const status = options.active ? chalk.hex(colors.signal)('● current') : '';
  const description = chalk.hex(colors.muted)(TUI_MODE_DESCRIPTIONS[mode]);
  const heading = `${prefix} ${label}`;

  if (options.compact) {
    return [
      fitWithRightMeta(heading, status, options.width),
      truncateToWidth(`  ${description}`, options.width, ''),
    ];
  }
  return [fitWithRightMeta(`${heading}  ${description}`, status, options.width)];
}

function formatTuiMode(mode: TuiMode): string {
  return mode === 'regular' ? 'Regular' : 'Fullscreen';
}

function readJudgeLabel(): string {
  try {
    return permissionJudgeView(getConfig()).label;
  } catch {
    return 'Not configured';
  }
}

function fitWithRightMeta(left: string, right: string, width: number): string {
  if (!right) return truncateToWidth(left, width, '');
  const gap = width - visibleWidth(left) - visibleWidth(right);
  if (gap >= 1) return `${left}${' '.repeat(gap)}${right}`;
  return truncateToWidth(`${left} ${right}`, width, '');
}
