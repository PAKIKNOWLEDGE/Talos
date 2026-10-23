/**
 * Native `web_search` backends. The tool shell is fixed; these ids only choose
 * which REST implementation runs. Default `auto` walks configured credentials
 * and does not bind MiniMax Matrix or any single vendor.
 */
export const WEB_SEARCH_PROVIDER_IDS = ['tavily', 'exa', 'deepseek'] as const;

export type WebSearchProviderId = (typeof WEB_SEARCH_PROVIDER_IDS)[number];

export type WebSearchProviderPreference = 'auto' | WebSearchProviderId;

export const WEB_SEARCH_PROVIDER_LABELS: Record<WebSearchProviderPreference, string> = {
  auto: 'Auto',
  tavily: 'Tavily',
  exa: 'Exa',
  deepseek: 'DeepSeek',
};

export interface WebSearchConfig {
  /** `auto` tries Tavily, then Exa, then DeepSeek, skipping backends without credentials. */
  provider: WebSearchProviderPreference;
  /** Legacy shared key; used only when `provider` is that explicit backend id. */
  apiKey?: string;
  tavilyApiKey?: string;
  exaApiKey?: string;
  deepseekApiKey?: string;
}

export type WebSearchNamedKeyField = 'tavilyApiKey' | 'exaApiKey' | 'deepseekApiKey';

export const WEB_SEARCH_NAMED_KEY_FIELDS: Record<WebSearchProviderId, WebSearchNamedKeyField> = {
  tavily: 'tavilyApiKey',
  exa: 'exaApiKey',
  deepseek: 'deepseekApiKey',
};

export const WEB_SEARCH_CONFIG_DEFAULTS: WebSearchConfig = {
  provider: 'auto',
};

export const WEB_SEARCH_PROVIDER_ENV_KEYS: Record<WebSearchProviderId, string> = {
  tavily: 'TAVILY_API_KEY',
  exa: 'EXA_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
};

export const WEB_SEARCH_PROVIDER_ENV = 'TALOS_WEB_SEARCH_PROVIDER';

export function isWebSearchProviderId(value: string): value is WebSearchProviderId {
  return (WEB_SEARCH_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isWebSearchProviderPreference(
  value: string,
): value is WebSearchProviderPreference {
  return value === 'auto' || isWebSearchProviderId(value);
}

export function parseWebSearchConfig(raw: unknown): WebSearchConfig {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...WEB_SEARCH_CONFIG_DEFAULTS };
  }
  const obj = raw as Record<string, unknown>;
  const providerRaw = typeof obj.provider === 'string' ? obj.provider.trim().toLowerCase() : '';
  const apiKey = readOptionalSecret(obj.apiKey);
  const tavilyApiKey = readOptionalSecret(obj.tavilyApiKey);
  const exaApiKey = readOptionalSecret(obj.exaApiKey);
  const deepseekApiKey = readOptionalSecret(obj.deepseekApiKey);
  return {
    provider: isWebSearchProviderPreference(providerRaw)
      ? providerRaw
      : WEB_SEARCH_CONFIG_DEFAULTS.provider,
    ...(apiKey ? { apiKey } : {}),
    ...(tavilyApiKey ? { tavilyApiKey } : {}),
    ...(exaApiKey ? { exaApiKey } : {}),
    ...(deepseekApiKey ? { deepseekApiKey } : {}),
  };
}

export function webSearchProviderKey(
  id: WebSearchProviderId,
  config: WebSearchConfig | undefined,
  env: NodeJS.Dict<string | undefined> = process.env,
): string | undefined {
  const fromEnv = env[WEB_SEARCH_PROVIDER_ENV_KEYS[id]]?.trim();
  if (fromEnv) return fromEnv;
  const named = config?.[WEB_SEARCH_NAMED_KEY_FIELDS[id]]?.trim();
  if (named) return named;
  if (config?.provider === id) {
    const shared = config.apiKey?.trim();
    if (shared) return shared;
  }
  return undefined;
}

export function listConfiguredWebSearchProviders(
  config: WebSearchConfig | undefined,
  env: NodeJS.Dict<string | undefined> = process.env,
): WebSearchProviderId[] {
  return WEB_SEARCH_PROVIDER_IDS.filter((id) => Boolean(webSearchProviderKey(id, config, env)));
}

export function webSearchSettingsView(
  config: WebSearchConfig | undefined,
  env: NodeJS.Dict<string | undefined> = process.env,
): { readonly provider: WebSearchProviderPreference; readonly label: string } {
  const provider = config?.provider ?? 'auto';
  const configured = listConfiguredWebSearchProviders(config, env);
  if (provider === 'auto') {
    return {
      provider,
      label: configured.length
        ? `Auto · ${configured.map((id) => WEB_SEARCH_PROVIDER_LABELS[id]).join(', ')}`
        : 'Auto · no key',
    };
  }
  return {
    provider,
    label: webSearchProviderKey(provider, config, env)
      ? WEB_SEARCH_PROVIDER_LABELS[provider]
      : `${WEB_SEARCH_PROVIDER_LABELS[provider]} · missing key`,
  };
}

function readOptionalSecret(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
