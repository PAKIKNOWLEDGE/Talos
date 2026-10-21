import { getConfig, permissionJudgeView } from '@mavis/config';
import { getKeybindings, type TuiMode } from '../../engine/public.js';
import type { Component } from '../../rendering/component.js';
import { truncateToWidth, visibleWidth } from '../../rendering/text.js';
import {
  TUI_SKIN_DESCRIPTIONS,
  TUI_SKIN_LABELS,
  TUI_SKINS,
  parseTuiSkin,
  type TuiSkin,
} from '../../skin.js';
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

const SETTINGS_MENU_ITEMS = ['terminal', 'interface', 'judge'] as const;
type SettingsMenuItem = (typeof SETTINGS_MENU_ITEMS)[number];
type SettingsPage = 'menu' | SettingsMenuItem;

export interface TuiSettingsInterfaceOptions {
  readonly currentSkin?: TuiSkin;
  readonly onSkinChange?: (skin: TuiSkin) => boolean;
}

export class TuiSettingsPicker implements Component {
  private page: SettingsPage = 'menu';
  private menuIndex = 0;
  private terminalIndex: number;
  private interfaceIndex: number;
  private currentSkin: TuiSkin;
  private readonly onSkinChange?: (skin: TuiSkin) => boolean;
  private judgePage: TuiJudgeSettings | undefined;

  constructor(
    private currentMode: TuiMode,
    private readonly onTuiModeChange: (mode: TuiMode) => boolean,
    private readonly onClose: () => void,
    private readonly judgePort?: TuiJudgeSettingsPort,
    private readonly requestRender: () => void = () => undefined,
    interfaceOptions: TuiSettingsInterfaceOptions = {},
  ) {
    this.terminalIndex = Math.max(0, TUI_MODES.indexOf(currentMode));
    this.currentSkin = parseTuiSkin(interfaceOptions.currentSkin);
    this.interfaceIndex = Math.max(0, TUI_SKINS.indexOf(this.currentSkin));
    this.onSkinChange = interfaceOptions.onSkinChange;
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
    if (this.page === 'interface') {
      this.handleInterfaceInput(data, keybindings);
      return;
    }
    if (keybindings.matches(data, 'tui.select.up')) {
      this.menuIndex =
        this.menuIndex === 0 ? SETTINGS_MENU_ITEMS.length - 1 : this.menuIndex - 1;
      return;
    }
    if (keybindings.matches(data, 'tui.select.down')) {
      this.menuIndex = (this.menuIndex + 1) % SETTINGS_MENU_ITEMS.length;
      return;
    }
    if (keybindings.matches(data, 'tui.select.confirm')) {
      const selected = SETTINGS_MENU_ITEMS[this.menuIndex];
      if (selected === 'terminal') {
        this.page = 'terminal';
        this.terminalIndex = Math.max(0, TUI_MODES.indexOf(this.currentMode));
      } else if (selected === 'interface') {
        this.page = 'interface';
        this.interfaceIndex = Math.max(0, TUI_SKINS.indexOf(this.currentSkin));
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
    if (this.page === 'interface') return this.renderInterface(width);
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

  private handleInterfaceInput(
    data: string,
    keybindings: ReturnType<typeof getKeybindings>,
  ): void {
    if (keybindings.matches(data, 'tui.select.up')) {
      this.interfaceIndex =
        this.interfaceIndex === 0 ? TUI_SKINS.length - 1 : this.interfaceIndex - 1;
      return;
    }
    if (keybindings.matches(data, 'tui.select.down')) {
      this.interfaceIndex = (this.interfaceIndex + 1) % TUI_SKINS.length;
      return;
    }
    if (keybindings.matches(data, 'tui.select.confirm')) {
      const selectedSkin = TUI_SKINS[this.interfaceIndex];
      if (!selectedSkin || selectedSkin === this.currentSkin) {
        this.onClose();
        return;
      }
      if (this.onSkinChange?.(selectedSkin) !== false) {
        this.currentSkin = selectedSkin;
        this.onClose();
      } else {
        this.interfaceIndex = TUI_SKINS.indexOf(this.currentSkin);
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
      { label: 'Interface', value: TUI_SKIN_LABELS[this.currentSkin] },
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

  private renderInterface(width: number): string[] {
    const safeWidth = Math.max(0, Math.floor(width));
    if (safeWidth === 0) return [];
    const contentWidth = questionnaireFrameContentWidth(safeWidth);
    const compact = contentWidth < 56;
    const currentSkin = TUI_SKIN_LABELS[this.currentSkin];
    return renderQuestionnaireFrame(
      {
        title: safeWidth < 42 ? `Settings · ${currentSkin}` : 'Settings',
        ...(safeWidth >= 42 ? { meta: `Interface · ${currentSkin}` } : {}),
        body: [
          chalk.hex(colors.muted)(
            compact
              ? 'Skin applies after restart.'
              : 'Choose a boot-frozen interface. Color themes still change live with /theme.',
          ),
          '',
          ...TUI_SKINS.flatMap((skin, index) =>
            renderSkin(skin, {
              active: skin === this.currentSkin,
              focused: index === this.interfaceIndex,
              compact,
              width: contentWidth,
            }),
          ),
        ],
        footer:
          safeWidth < 42
            ? '↑/↓ move · Enter save · Esc back'
            : '↑/↓ select · Enter save · Esc back',
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

function renderSkin(
  skin: TuiSkin,
  options: {
    readonly active: boolean;
    readonly focused: boolean;
    readonly compact: boolean;
    readonly width: number;
  },
): string[] {
  const prefix = options.focused ? chalk.bold.hex(colors.signal)('›') : ' ';
  const label = (options.focused ? chalk.bold.hex(colors.signal) : chalk.hex(colors.text))(
    TUI_SKIN_LABELS[skin].padEnd(10),
  );
  const status = options.active ? chalk.hex(colors.signal)('● current') : '';
  const description = chalk.hex(colors.muted)(TUI_SKIN_DESCRIPTIONS[skin]);
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
