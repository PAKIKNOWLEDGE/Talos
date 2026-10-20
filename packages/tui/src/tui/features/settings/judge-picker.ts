import {
  getConfig,
  parsePermissionJudgeConfig,
  permissionJudgeView,
  resolvePermissionJudgeCredentials,
  testPermissionJudgeCredentials,
  writePermissionJudgeConfig,
  type PermissionJudgeConfig,
} from '@mavis/config';
import type { TuiModel } from '../../../types/runtime-models.js';
import { getKeybindings, Input, Key, matchesKey } from '../../engine/public.js';
import type { Component, Focusable } from '../../rendering/component.js';
import { truncateToWidth } from '../../rendering/text.js';
import { sanitizeTerminalText } from '../../rendering/terminal-text.js';
import { sanitizeTuiUrl } from '../../rendering/url.js';
import { tuiChalk as chalk, tuiColors as colors } from '../../theme/runtime.js';
import {
  questionnaireFrameContentWidth,
  renderQuestionnaireFrame,
} from '../interaction/decision-frame.js';

export interface TuiJudgeSettingsPort {
  listReusableModels(): Promise<readonly TuiModel[]>;
}

type JudgePage = 'list' | 'manual';

const MANUAL_FIELDS = 5;

export class TuiJudgeSettings implements Component, Focusable {
  private page: JudgePage = 'list';
  private models: readonly TuiModel[] = [];
  private selected = 0;
  private field = 0;
  private editing = false;
  private busy = false;
  private status = '';
  private error = '';
  private _focused = false;
  private manualModel = '';
  private manualBaseUrl = '';
  private manualApiKey = '';
  private readonly textInput = new Input({ prompt: '' });
  private readonly secretInput = new Input({ prompt: '', mask: '•' });

  constructor(
    private readonly port: TuiJudgeSettingsPort,
    private readonly onClose: () => void,
    private readonly requestRender: () => void,
  ) {
    this.textInput.onSubmit = (value) => this.commitField(value);
    this.secretInput.onSubmit = (value) => this.commitField(value);
    this.textInput.onEscape = this.secretInput.onEscape = () => {
      this.editing = false;
    };
    void this.reloadModels();
  }

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.syncFocus();
  }

  handleInput(data: string): void {
    if (this.busy) return;
    if (this.page === 'manual') {
      this.handleManualInput(data);
      this.requestRender();
      return;
    }
    const rows = this.listRows();
    if (getKeybindings().matches(data, 'tui.select.cancel')) {
      this.onClose();
      return;
    }
    if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
    else if (matchesKey(data, Key.down) || matchesKey(data, 'tab')) {
      this.selected = Math.min(Math.max(0, rows.length - 1), this.selected + 1);
    } else if (matchesKey(data, Key.enter) && rows[this.selected]) {
      void this.choose(rows[this.selected]!.id);
    }
    this.requestRender();
  }

  render(width: number): string[] {
    const safeWidth = Math.max(0, Math.floor(width));
    if (safeWidth === 0) return [];
    const contentWidth = questionnaireFrameContentWidth(safeWidth);
    if (this.page === 'manual') return this.renderManual(safeWidth, contentWidth);
    const view = permissionJudgeView(getConfig());
    const rows = this.listRows();
    return renderQuestionnaireFrame(
      {
        title: 'LLM judge',
        meta: view.label,
        body: [
          chalk.hex(colors.muted)(
            'Reuse a /model credential, or enter a separate judge such as DeepSeek.',
          ),
          '',
          ...rows.map((row, index) => {
            const prefix = index === this.selected ? chalk.bold.hex(colors.signal)('›') : ' ';
            const paint = index === this.selected ? chalk.bold.hex(colors.signal) : chalk.hex(colors.text);
            return `${prefix} ${paint(truncateToWidth(row.label, Math.max(8, contentWidth - 2), ''))}`;
          }),
          ...(this.error ? ['', chalk.hex(colors.error)(this.error)] : []),
          ...(this.status ? ['', chalk.hex(colors.muted)(this.status)] : []),
        ],
        footer: '↑/↓ select · Enter apply · Esc back',
      },
      safeWidth,
      'signal',
    );
  }

  invalidate(): void {}

  private listRows(): readonly { readonly id: string; readonly label: string }[] {
    const reusable = this.models
      .filter((model) => model.providerKind !== 'oauth' && model.providerId !== 'minimax')
      .map((model) => ({
        id: `reuse:${model.providerId}/${model.modelId}`,
        label: `Reuse ${model.displayName ?? model.modelId} · ${model.providerName ?? model.providerId}`,
      }));
    return [
      ...reusable,
      { id: 'manual', label: 'Enter a separate judge…' },
      { id: 'clear', label: 'Clear judge (auto will ask)' },
    ];
  }

  private async reloadModels(): Promise<void> {
    try {
      this.models = await this.port.listReusableModels();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.models = [];
    }
    this.requestRender();
  }

  private async choose(id: string): Promise<void> {
    if (id === 'manual') {
      const current = getConfig().permission?.judge;
      this.manualModel = current?.source === 'manual' ? current.model ?? '' : '';
      this.manualBaseUrl = current?.source === 'manual' ? current.baseURL ?? '' : '';
      this.manualApiKey = '';
      this.page = 'manual';
      this.field = 0;
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      if (id === 'clear') {
        await writePermissionJudgeConfig(null);
        this.status = 'Judge cleared. Auto will ask when local rules do not decide.';
        return;
      }
      if (!id.startsWith('reuse:')) return;
      const rest = id.slice('reuse:'.length);
      const slash = rest.indexOf('/');
      if (slash <= 0) return;
      await writePermissionJudgeConfig({
        source: 'provider',
        providerId: rest.slice(0, slash),
        modelId: rest.slice(slash + 1),
      });
      this.status = `Judge reuses ${rest}.`;
      this.onClose();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
    }
  }

  private handleManualInput(data: string): void {
    if (this.editing) {
      (this.field === 2 ? this.secretInput : this.textInput).handleInput(data);
      return;
    }
    if (getKeybindings().matches(data, 'tui.select.cancel')) {
      this.page = 'list';
      return;
    }
    if (matchesKey(data, Key.up)) this.field = Math.max(0, this.field - 1);
    else if (matchesKey(data, Key.down) || matchesKey(data, 'tab')) {
      this.field = (this.field + 1) % MANUAL_FIELDS;
    } else if (matchesKey(data, Key.enter)) {
      if (this.field === 3) void this.testManual();
      else if (this.field === 4) void this.saveManual();
      else this.beginEdit();
    }
  }

  private beginEdit(): void {
    this.editing = true;
    const current = this.field === 0 ? this.manualModel : this.field === 1 ? this.manualBaseUrl : '';
    const input = this.field === 2 ? this.secretInput : this.textInput;
    input.setValue(current);
    input.moveCursorToEnd();
    this.syncFocus();
  }

  private commitField(value: string): void {
    const trimmed = value.trim();
    if (this.field === 0) this.manualModel = trimmed;
    else if (this.field === 1) this.manualBaseUrl = trimmed;
    else if (this.field === 2) this.manualApiKey = trimmed;
    this.editing = false;
  }

  private async testManual(): Promise<void> {
    const creds = this.resolveDraft();
    if (!creds) {
      this.error = 'Fill model, base URL, and API key first.';
      return;
    }
    this.busy = true;
    this.error = '';
    this.status = 'Testing judge…';
    this.requestRender();
    try {
      const result = await testPermissionJudgeCredentials(creds);
      this.status = result.message;
      if (!result.ok) this.error = result.message;
    } finally {
      this.busy = false;
    }
  }

  private async saveManual(): Promise<void> {
    const config = this.draftManual();
    const creds = this.resolveDraft();
    if (!config || !creds) {
      this.error = 'Fill model, base URL, and API key first.';
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const result = await testPermissionJudgeCredentials(creds);
      if (!result.ok) {
        this.error = result.message;
        return;
      }
      await writePermissionJudgeConfig(config);
      this.status = 'Saved separate judge.';
      this.onClose();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
    }
  }

  private draftManual(): PermissionJudgeConfig | undefined {
    return parsePermissionJudgeConfig({
      source: 'manual',
      model: this.manualModel,
      baseURL: this.manualBaseUrl,
      apiKey: this.manualApiKey || getConfig().permission?.judge?.apiKey,
    });
  }

  private resolveDraft() {
    const config = this.draftManual();
    if (!config) return undefined;
    return resolvePermissionJudgeCredentials({
      ...getConfig(),
      permission: { ...getConfig().permission, judge: config },
    });
  }

  private renderManual(safeWidth: number, contentWidth: number): string[] {
    const fields = [
      `Model: ${sanitizeTerminalText(this.manualModel || '(empty)')}`,
      `Base URL: ${sanitizeTuiUrl(this.manualBaseUrl || '(empty)')}`,
      `API key: ${this.manualApiKey ? 'Replacement entered' : getConfig().permission?.judge?.apiKey ? 'Saved key (unchanged)' : 'Not configured'}`,
      'Test connection',
      'Save',
    ];
    return renderQuestionnaireFrame(
      {
        title: 'Separate LLM judge',
        meta: 'Does not change /model',
        body: [
          chalk.hex(colors.muted)(
            'Use this when the judge should be a different provider than the coding model.',
          ),
          '',
          ...fields.map((field, index) => {
            const prefix = index === this.field ? chalk.bold.hex(colors.signal)('›') : ' ';
            const paint = index === this.field ? chalk.bold.hex(colors.signal) : chalk.hex(colors.text);
            return `${prefix} ${paint(truncateToWidth(field, Math.max(8, contentWidth - 2), ''))}`;
          }),
          ...(this.editing
            ? ['', ...(this.field === 2 ? this.secretInput : this.textInput).render(contentWidth)]
            : []),
          ...(this.error ? ['', chalk.hex(colors.error)(this.error)] : []),
          ...(this.status ? ['', chalk.hex(colors.muted)(this.status)] : []),
        ],
        footer: '↑/↓ field · Enter edit/test/save · Esc back',
      },
      safeWidth,
      'signal',
    );
  }

  private syncFocus(): void {
    this.textInput.focused = this._focused && this.editing && this.field !== 2;
    this.secretInput.focused = this._focused && this.editing && this.field === 2;
  }
}
