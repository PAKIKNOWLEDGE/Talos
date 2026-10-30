import { decodePrintableKey, getKeybindings, matchesKey } from '../../engine/public.js';
import type { Component, Focusable } from '../../rendering/component.js';
import { sanitizeTerminalText } from '../../rendering/terminal-text.js';
import { panelLayout, renderPanelFrame } from '../../widgets/panel-frame.js';
import type { TuiSavedPermissionRule } from '../../../runtime/port.js';

export interface TuiPermissionRulesPanelOptions {
  rules: readonly TuiSavedPermissionRule[];
  onDelete(rule: TuiSavedPermissionRule): Promise<void>;
  onCancel(): void;
  requestRender(): void;
}

export class TuiPermissionRulesPanel implements Component, Focusable {
  readonly fullscreenViewport = true;
  readonly handlesViewportKeys = true;
  private rules: TuiSavedPermissionRule[];
  private view: RuleView = 'all';
  private selectedIndex = 0;
  private windowStart = 0;
  private busy = false;
  private status?: string;
  private _focused = false;

  constructor(private readonly options: TuiPermissionRulesPanelOptions) {
    this.rules = [...options.rules].sort(compareRules);
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  handleInput(data: string): void {
    if (this.busy) return;
    if (matchesKey(data, 'up')) {
      this.move(-1);
      return;
    }
    if (matchesKey(data, 'down')) {
      this.move(1);
      return;
    }
    if (getKeybindings().matches(data, 'tui.select.cancel')) {
      this.options.onCancel();
      return;
    }
    const printable = (decodePrintableKey(data) ?? data).toLocaleLowerCase();
    if (printable === 'f') {
      this.cycleView();
      return;
    }
    if (printable === 'd') void this.deleteSelected();
  }

  invalidate(): void {}

  render(width: number): string[] {
    return this.renderViewport(width, Number.POSITIVE_INFINITY);
  }

  renderViewport(width: number, height: number): string[] {
    const footer = '↑↓ move · f filter · d delete · Esc close';
    const frameHeight = Number.isFinite(height) ? height : undefined;
    const { bodyHeight } = panelLayout(width, frameHeight, footer);
    const statusRows = this.status ? 1 : 0;
    const ruleRows = Math.max(0, bodyHeight - statusRows);
    const shown = this.shownRules();
    const selected = shown[this.selectedIndex];
    const body =
      shown.length === 0 ? [emptyRulesMessage(this.view)] : this.visibleRuleLines(ruleRows);
    return renderPanelFrame(
      {
        title: 'Saved permission rules',
        meta: ruleMeta(this.view, selected ? this.selectedIndex + 1 : 0, shown.length),
        body: this.status ? [...body, this.status] : body,
        footer,
      },
      width,
      frameHeight,
      selected?.behavior === 'deny' ? 'error' : 'signal',
    );
  }

  private visibleRuleLines(rowCount: number): string[] {
    const shown = this.shownRules();
    const count = Math.max(0, Math.min(rowCount, shown.length));
    const maxStart = Math.max(0, shown.length - count);
    if (this.selectedIndex < this.windowStart) this.windowStart = this.selectedIndex;
    if (count > 0 && this.selectedIndex >= this.windowStart + count) {
      this.windowStart = this.selectedIndex - count + 1;
    }
    this.windowStart = Math.min(Math.max(0, this.windowStart), maxStart);
    return shown.slice(this.windowStart, this.windowStart + count).map((rule, offset) => {
      const index = this.windowStart + offset;
      const mark = index === this.selectedIndex ? '› ' : '  ';
      return sanitizeTerminalText(`${mark}${formatRule(rule)}`);
    });
  }

  private move(delta: number): void {
    const shown = this.shownRules();
    if (shown.length === 0) return;
    this.selectedIndex = Math.min(shown.length - 1, Math.max(0, this.selectedIndex + delta));
    this.options.requestRender();
  }

  private cycleView(): void {
    this.view = this.view === 'all' ? 'deny' : this.view === 'deny' ? 'allow' : 'all';
    this.selectedIndex = 0;
    this.windowStart = 0;
    this.options.requestRender();
  }

  private shownRules(): readonly TuiSavedPermissionRule[] {
    if (this.view === 'all') return this.rules;
    return this.rules.filter((rule) => rule.behavior === this.view);
  }

  private async deleteSelected(): Promise<void> {
    const rule = this.shownRules()[this.selectedIndex];
    if (!rule) return;
    this.busy = true;
    this.status = 'Removing…';
    this.options.requestRender();
    try {
      await this.options.onDelete(rule);
      this.rules = this.rules.filter((item) => item !== rule);
      this.selectedIndex = Math.min(
        this.selectedIndex,
        Math.max(0, this.shownRules().length - 1),
      );
      this.status = 'Rule removed. It applies on the next tool check.';
    } catch (error) {
      this.status = error instanceof Error ? error.message : 'Could not remove that rule.';
    } finally {
      this.busy = false;
      this.options.requestRender();
    }
  }
}

type RuleView = 'all' | 'deny' | 'allow';

function ruleMeta(view: RuleView, position: number, count: number): string {
  const fraction = count === 0 ? '0' : `${position}/${count}`;
  return view === 'all' ? fraction : `${fraction} ${view}`;
}

function emptyRulesMessage(view: RuleView): string {
  if (view === 'deny') return 'No deny rules.';
  if (view === 'allow') return 'No allow rules.';
  return 'No saved permission rules.';
}

function compareRules(left: TuiSavedPermissionRule, right: TuiSavedPermissionRule): number {
  return rank(left) - rank(right);
}

function rank(rule: TuiSavedPermissionRule): number {
  const behavior = rule.behavior === 'deny' ? 0 : rule.behavior === 'ask' ? 1 : 2;
  const source = rule.source === 'session' ? 0 : rule.source === 'global' ? 1 : 2;
  return behavior * 10 + source;
}

function formatRule(rule: TuiSavedPermissionRule): string {
  return `${rule.behavior} · ${rule.toolName} · ${ruleScope(rule)} · ${rule.source}`;
}

function ruleScope(rule: TuiSavedPermissionRule): string {
  const matcher = rule.matcher;
  if (!matcher || matcher.kind === 'tool') return rule.ruleContent || 'entire tool';
  return matcher.pattern || rule.ruleContent || 'entire tool';
}
