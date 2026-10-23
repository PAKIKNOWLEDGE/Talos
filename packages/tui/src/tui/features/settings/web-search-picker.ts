import {
  getConfig,
  webSearchProviderKey,
  webSearchSettingsView,
  WEB_SEARCH_PROVIDER_IDS,
  WEB_SEARCH_PROVIDER_LABELS,
  writeWebSearchConfig,
  type WebSearchConfigPatch,
  type WebSearchProviderId,
  type WebSearchProviderPreference,
} from '@mavis/config';
import { getKeybindings, Input, Key, matchesKey } from '../../engine/public.js';
import type { Component, Focusable } from '../../rendering/component.js';
import { truncateToWidth } from '../../rendering/text.js';
import { tuiChalk as chalk, tuiColors as colors } from '../../theme/runtime.js';
import {
  questionnaireFrameContentWidth,
  renderQuestionnaireFrame,
} from '../interaction/decision-frame.js';

type SearchPage = 'list' | 'keys';

const LIST_IDS = ['auto', ...WEB_SEARCH_PROVIDER_IDS, 'keys'] as const;
type ListId = (typeof LIST_IDS)[number];

export class TuiWebSearchSettings implements Component, Focusable {
  private page: SearchPage = 'list';
  private selected = 0;
  private field = 0;
  private editing = false;
  private busy = false;
  private status = '';
  private error = '';
  private _focused = false;
  private keyProvider: WebSearchProviderPreference = 'auto';
  private tavilyApiKey = '';
  private exaApiKey = '';
  private deepseekApiKey = '';
  private readonly secretInput = new Input({ prompt: '', mask: '•' });

  constructor(
    private readonly onClose: () => void,
    private readonly requestRender: () => void,
  ) {
    this.secretInput.onSubmit = (value) => this.commitField(value);
    this.secretInput.onEscape = () => {
      this.editing = false;
    };
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
    if (this.page === 'keys') {
      this.handleKeysInput(data);
      this.requestRender();
      return;
    }
    if (getKeybindings().matches(data, 'tui.select.cancel')) {
      this.onClose();
      return;
    }
    if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
    else if (matchesKey(data, Key.down) || matchesKey(data, 'tab')) {
      this.selected = Math.min(LIST_IDS.length - 1, this.selected + 1);
    } else if (matchesKey(data, Key.enter) && LIST_IDS[this.selected]) {
      void this.choose(LIST_IDS[this.selected]!);
    }
    this.requestRender();
  }

  render(width: number): string[] {
    const safeWidth = Math.max(0, Math.floor(width));
    if (safeWidth === 0) return [];
    const contentWidth = questionnaireFrameContentWidth(safeWidth);
    if (this.page === 'keys') return this.renderKeys(safeWidth, contentWidth);
    const view = webSearchSettingsView(safeConfig()?.webSearch);
    const rows = this.listRows();
    return renderQuestionnaireFrame(
      {
        title: 'Web search',
        meta: view.label,
        body: [
          chalk.hex(colors.muted)(
            'Choose the backend for web_search. Auto uses whichever API key is saved.',
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

  private listRows(): readonly { readonly id: ListId; readonly label: string }[] {
    const config = safeConfig()?.webSearch;
    const current = config?.provider ?? 'auto';
    return LIST_IDS.map((id) => {
      if (id === 'keys') return { id, label: 'Edit API keys…' };
      const currentMark = id === current ? ' · current' : '';
      if (id === 'auto') return { id, label: `Auto — walk configured keys${currentMark}` };
      const hasKey = Boolean(webSearchProviderKey(id, config));
      return {
        id,
        label: `${WEB_SEARCH_PROVIDER_LABELS[id]}${hasKey ? '' : ' · needs key'}${currentMark}`,
      };
    });
  }

  private async choose(id: ListId): Promise<void> {
    this.error = '';
    if (id === 'keys') {
      this.openKeys('auto');
      return;
    }
    const config = safeConfig()?.webSearch;
    if (id !== 'auto' && !webSearchProviderKey(id, config)) {
      this.openKeys(id);
      return;
    }
    this.busy = true;
    try {
      await writeWebSearchConfig({ provider: id });
      this.status = `Using ${WEB_SEARCH_PROVIDER_LABELS[id]}.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
    }
  }

  private openKeys(provider: WebSearchProviderPreference): void {
    this.keyProvider = provider;
    this.tavilyApiKey = '';
    this.exaApiKey = '';
    this.deepseekApiKey = '';
    this.field = 0;
    this.editing = false;
    this.page = 'keys';
  }

  private handleKeysInput(data: string): void {
    if (this.editing) {
      this.secretInput.handleInput(data);
      return;
    }
    if (getKeybindings().matches(data, 'tui.select.cancel')) {
      this.page = 'list';
      return;
    }
    const fieldCount = this.keyFields().length;
    if (matchesKey(data, Key.up)) this.field = Math.max(0, this.field - 1);
    else if (matchesKey(data, Key.down) || matchesKey(data, 'tab')) {
      this.field = (this.field + 1) % fieldCount;
    } else if (matchesKey(data, Key.enter)) {
      if (this.field === fieldCount - 1) void this.saveKeys();
      else this.beginEdit();
    }
  }

  private keyFields(): readonly { readonly id: WebSearchProviderId | 'save'; readonly label: string }[] {
    const providers: readonly WebSearchProviderId[] =
      this.keyProvider === 'auto' ? WEB_SEARCH_PROVIDER_IDS : [this.keyProvider];
    return [
      ...providers.map((id) => ({
        id,
        label: `${WEB_SEARCH_PROVIDER_LABELS[id]} key: ${this.keyStatus(id)}`,
      })),
      { id: 'save', label: 'Save' },
    ];
  }

  private keyStatus(id: WebSearchProviderId): string {
    if (this.enteredKey(id)) return 'Replacement entered';
    return webSearchProviderKey(id, safeConfig()?.webSearch) ? 'Saved key (unchanged)' : 'Not configured';
  }

  private enteredKey(id: WebSearchProviderId): string {
    if (id === 'tavily') return this.tavilyApiKey;
    if (id === 'exa') return this.exaApiKey;
    return this.deepseekApiKey;
  }

  private beginEdit(): void {
    this.editing = true;
    this.secretInput.setValue('');
    this.secretInput.moveCursorToEnd();
    this.syncFocus();
  }

  private commitField(value: string): void {
    const trimmed = value.trim();
    const field = this.keyFields()[this.field];
    if (field?.id === 'tavily') this.tavilyApiKey = trimmed;
    else if (field?.id === 'exa') this.exaApiKey = trimmed;
    else if (field?.id === 'deepseek') this.deepseekApiKey = trimmed;
    this.editing = false;
  }

  private async saveKeys(): Promise<void> {
    const providers: readonly WebSearchProviderId[] =
      this.keyProvider === 'auto' ? WEB_SEARCH_PROVIDER_IDS : [this.keyProvider];
    if (this.keyProvider !== 'auto') {
      const id = this.keyProvider;
      if (!this.enteredKey(id) && !webSearchProviderKey(id, safeConfig()?.webSearch)) {
        this.error = `Enter a ${WEB_SEARCH_PROVIDER_LABELS[id]} API key first.`;
        return;
      }
    }
    const patch: WebSearchConfigPatch = {
      provider: this.keyProvider === 'auto' ? 'auto' : this.keyProvider,
    };
    for (const id of providers) {
      const entered = this.enteredKey(id);
      if (entered) {
        if (id === 'tavily') patch.tavilyApiKey = entered;
        else if (id === 'exa') patch.exaApiKey = entered;
        else patch.deepseekApiKey = entered;
      }
    }
    this.busy = true;
    this.error = '';
    try {
      await writeWebSearchConfig(patch);
      this.status = `Saved ${WEB_SEARCH_PROVIDER_LABELS[patch.provider ?? 'auto']}.`;
      this.page = 'list';
      this.tavilyApiKey = '';
      this.exaApiKey = '';
      this.deepseekApiKey = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
    }
  }

  private renderKeys(safeWidth: number, contentWidth: number): string[] {
    const fields = this.keyFields();
    const title =
      this.keyProvider === 'auto' ? 'Web search keys' : `${WEB_SEARCH_PROVIDER_LABELS[this.keyProvider]} API key`;
    return renderQuestionnaireFrame(
      {
        title,
        meta: 'Stored in config.yaml',
        body: [
          chalk.hex(colors.muted)(
            this.keyProvider === 'auto'
              ? 'Leave a field empty to keep the saved key. Auto uses the first configured backend.'
              : `web_search will call ${WEB_SEARCH_PROVIDER_LABELS[this.keyProvider]}.`,
          ),
          '',
          ...fields.map((field, index) => {
            const prefix = index === this.field ? chalk.bold.hex(colors.signal)('›') : ' ';
            const paint = index === this.field ? chalk.bold.hex(colors.signal) : chalk.hex(colors.text);
            return `${prefix} ${paint(truncateToWidth(field.label, Math.max(8, contentWidth - 2), ''))}`;
          }),
          ...(this.editing ? ['', ...this.secretInput.render(contentWidth)] : []),
          ...(this.error ? ['', chalk.hex(colors.error)(this.error)] : []),
          ...(this.status ? ['', chalk.hex(colors.muted)(this.status)] : []),
        ],
        footer: '↑/↓ field · Enter edit/save · Esc back',
      },
      safeWidth,
      'signal',
    );
  }

  private syncFocus(): void {
    this.secretInput.focused = this._focused && this.editing;
  }
}

function safeConfig() {
  try {
    return getConfig();
  } catch {
    return undefined;
  }
}
