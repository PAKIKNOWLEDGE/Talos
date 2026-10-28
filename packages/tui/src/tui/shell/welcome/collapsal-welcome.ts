import type { Component } from '../../rendering/component.js';
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from '../../rendering/text.js';
import { tuiChalk as chalk, tuiColors as colors } from '../../theme/runtime.js';
import type { TuiShellState } from '../contracts.js';
import { collapsalWelcomeArt } from './collapsal-art.js';
import { TALOS_WELCOME_DESIGN } from './design.js';

export const COLLAPSAL_WELCOME_COMMANDS = ['/init', '/plan', '/sessions', '/provider'] as const;

const MIN_TWO_COLUMN_WIDTH = 62;
const MIN_RIGHT_COLUMN_WIDTH = 20;

export function renderCollapsalWelcome(
  state: TuiShellState,
  width: number,
  options: {
    readonly density?: 'standard' | 'compact';
    readonly notice?: string;
    readonly changelogEntries?: readonly string[];
  } = {},
): string[] {
  const compact = options.density === 'compact' || width < MIN_TWO_COLUMN_WIDTH;
  return compact
    ? renderSingleColumn(state, width, options)
    : renderTwoColumn(state, width, options);
}

function renderTwoColumn(
  state: TuiShellState,
  width: number,
  options: {
    readonly notice?: string;
    readonly changelogEntries?: readonly string[];
  },
): string[] {
  const leftWidth = resolveLeftWidth(width);
  const rightWidth = Math.max(0, width - leftWidth - 7);
  const art = collapsalWelcomeArt(leftWidth).map((line) =>
    chalk.bold.hex(colors.brand)(line),
  );
  const left = [...art, '', ...renderMeta(state)];
  const right = renderRightColumn(rightWidth);
  const rows = Math.max(left.length, right.length);
  const body = Array.from({ length: rows }, (_, index) =>
    splitRow(left[index] ?? '', right[index] ?? '', leftWidth, width),
  );
  const notes = renderUpdateSection(options.changelogEntries, width, 3);
  return [
    renderHeader(state, width),
    ...renderNoticeRows(options.notice, width),
    ...body,
    ...(notes.length > 0
      ? [splitJoin(leftWidth, width), ...notes, renderBottom(width)]
      : [splitBottom(leftWidth, width)]),
  ];
}

function renderSingleColumn(
  state: TuiShellState,
  width: number,
  options: {
    readonly notice?: string;
    readonly changelogEntries?: readonly string[];
  },
): string[] {
  const inner = Math.max(0, width - 4);
  const art =
    inner >= 22 ? collapsalWelcomeArt(inner).map((line) => chalk.bold.hex(colors.brand)(line)) : [];
  const commands = COLLAPSAL_WELCOME_COMMANDS.slice(0, 2).map((command) =>
    chalk.hex(colors.dim)(command),
  );
  const notes = renderUpdateSection(options.changelogEntries, width, 2);
  return [
    renderHeader(state, width),
    ...renderNoticeRows(options.notice, width),
    ...art.map((line) => frameRow(line, width)),
    ...renderMeta(state).map((line) => frameRow(line, width)),
    frameRow('', width),
    frameRow(chalk.bold.hex(colors.text)('Welcome'), width),
    ...commands.map((command) => frameRow(command, width)),
    ...(notes.length > 0 ? [frameRow('', width), ...notes] : []),
    renderBottom(width),
  ];
}

function renderRightColumn(width: number): string[] {
  const divider = chalk.hex(colors.line)('─'.repeat(Math.min(10, Math.max(0, width))));
  return [
    chalk.bold.hex(colors.text)('Welcome'),
    chalk.hex(colors.muted)('Ask Talos anything'),
    divider,
    ...COLLAPSAL_WELCOME_COMMANDS.map((command) => chalk.hex(colors.dim)(command)),
  ];
}

function renderUpdateSection(
  changelogEntries: readonly string[] | undefined,
  width: number,
  limit: number,
): string[] {
  if (!changelogEntries?.length) return [];
  const inner = Math.max(1, width - 4);
  const title = chalk.bold.hex(colors.brand)(TALOS_WELCOME_DESIGN.sectionTitles.news);
  const mark = `${chalk.bold.hex(colors.orbit)('›')} `;
  const wrapWidth = Math.max(1, inner - 2);
  const rows = [frameRow(title, width)];
  for (const entry of changelogEntries.slice(0, limit)) {
    const wrapped = wrapTextWithAnsi(entry, wrapWidth);
    wrapped.forEach((line, index) => {
      const prefix = index === 0 ? mark : '  ';
      rows.push(frameRow(`${prefix}${chalk.hex(colors.text)(line)}`, width));
    });
  }
  return rows;
}

function renderMeta(state: TuiShellState): string[] {
  return [
    chalk.hex(colors.muted)(state.model?.trim() || '—'),
    chalk.hex(colors.muted)(formatCollapsalWorkspace(state.workspace, state.homeDir)),
  ];
}

function resolveLeftWidth(width: number): number {
  const maxLeft = Math.max(12, width - 7 - MIN_RIGHT_COLUMN_WIDTH);
  const artWidth = Math.max(
    1,
    ...collapsalWelcomeArt(maxLeft).map((line) => visibleWidth(line)),
  );
  return Math.min(maxLeft, Math.max(artWidth, 16));
}

function renderHeader(state: TuiShellState, width: number): string {
  const title = chalk.bold.hex(colors.brand)(`Talos v${state.version}`);
  const start = `${hairline('┌─')} ${title} `;
  const end = hairline('┐');
  const fill = Math.max(0, width - visibleWidth(start) - visibleWidth(end));
  return `${start}${hairline('─'.repeat(fill))}${end}`;
}

function renderNoticeRows(notice: string | undefined, width: number): string[] {
  if (!notice) return [];
  const mark = chalk.bold.hex(colors.warning)('○');
  const text = chalk.bold.hex(colors.warning)(notice);
  return [frameRow(`${mark} ${text}`, width)];
}

function frameRow(content: string, width: number): string {
  const inner = Math.max(0, width - 4);
  const fitted = truncateToWidth(content, inner, chalk.hex(colors.muted)('…'));
  return `${hairline('│')} ${fitted}${' '.repeat(Math.max(0, inner - visibleWidth(fitted)))} ${hairline('│')}`;
}

function splitRow(left: string, right: string, leftWidth: number, width: number): string {
  const rightWidth = Math.max(0, width - leftWidth - 7);
  return `${hairline('│')} ${padCell(left, leftWidth)} ${hairline('│')} ${padCell(right, rightWidth)} ${hairline('│')}`;
}

function splitJoin(leftWidth: number, width: number): string {
  const rightWidth = Math.max(0, width - leftWidth - 7);
  return `${hairline('├')}${hairline('─'.repeat(leftWidth + 2))}${hairline('┴')}${hairline(
    '─'.repeat(rightWidth + 2),
  )}${hairline('┤')}`;
}

function splitBottom(leftWidth: number, width: number): string {
  const rightWidth = Math.max(0, width - leftWidth - 7);
  return `${hairline('└')}${hairline('─'.repeat(leftWidth + 2))}${hairline('┴')}${hairline(
    '─'.repeat(rightWidth + 2),
  )}${hairline('┘')}`;
}

function renderBottom(width: number): string {
  return `${hairline('└')}${hairline('─'.repeat(Math.max(0, width - 2)))}${hairline('┘')}`;
}

function padCell(content: string, width: number): string {
  const fitted = truncateToWidth(content, width, chalk.hex(colors.muted)('…'));
  return `${fitted}${' '.repeat(Math.max(0, width - visibleWidth(fitted)))}`;
}

function hairline(value: string): string {
  return chalk.hex(colors.line)(value);
}

function formatCollapsalWorkspace(workspace: string, homeDir: string | undefined): string {
  if (!homeDir) return workspace;
  if (workspace === homeDir) return '~';
  if (workspace.startsWith(`${homeDir}/`) || workspace.startsWith(`${homeDir}\\`)) {
    return `~${workspace.slice(homeDir.length)}`;
  }
  return workspace;
}

/** Compact identity frame pinned above the fullscreen transcript. */
export function renderCollapsalSessionHeader(state: TuiShellState, width: number): string[] {
  if (width < 20) {
    return [
      truncateToWidth(
        chalk.bold.hex(colors.brand)(`Talos v${state.version}`),
        width,
        chalk.hex(colors.muted)('…'),
      ),
    ];
  }
  const model = chalk.hex(colors.muted)(state.model?.trim() || '—');
  const cwd = chalk.hex(colors.dim)(formatCollapsalWorkspace(state.workspace, state.homeDir));
  return [renderHeader(state, width), frameRow(`${model}  ${cwd}`, width), renderBottom(width)];
}

export class TuiCollapsalSessionHeader implements Component {
  constructor(private state: TuiShellState) {}

  setState(state: TuiShellState): void {
    this.state = state;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
    if (safeWidth === 0) return [];
    return renderCollapsalSessionHeader(this.state, safeWidth);
  }
}
