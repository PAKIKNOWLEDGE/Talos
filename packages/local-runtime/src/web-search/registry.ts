import {
  isWebSearchProviderPreference,
  webSearchProviderKey,
  WEB_SEARCH_PROVIDER_ENV,
  WEB_SEARCH_PROVIDER_ENV_KEYS,
  WEB_SEARCH_PROVIDER_IDS,
  type WebSearchConfig,
  type WebSearchProviderId,
  type WebSearchProviderPreference,
} from '@mavis/config';

import { deepseekProvider } from './providers/deepseek.js';
import { exaProvider } from './providers/exa.js';
import { tavilyProvider } from './providers/tavily.js';
import type { WebSearchProvider } from './types.js';

const PROVIDERS: Record<WebSearchProviderId, WebSearchProvider> = {
  tavily: tavilyProvider,
  exa: exaProvider,
  deepseek: deepseekProvider,
};

/** Specialized search APIs first so `auto` does not crown DeepSeek. */
export const WEB_SEARCH_AUTO_ORDER: readonly WebSearchProviderId[] = ['tavily', 'exa', 'deepseek'];

export function resolveWebSearchPreference(
  config: WebSearchConfig | undefined,
  env: NodeJS.Dict<string | undefined> = process.env,
): WebSearchProviderPreference {
  const fromEnv = env[WEB_SEARCH_PROVIDER_ENV]?.trim().toLowerCase();
  if (fromEnv && isWebSearchProviderPreference(fromEnv)) return fromEnv;
  return config?.provider ?? 'auto';
}

export function resolveProviderCandidates(
  preference: WebSearchProviderPreference,
): { id: WebSearchProviderId; explicit: boolean }[] {
  if (preference === 'auto') {
    return WEB_SEARCH_AUTO_ORDER.map((id) => ({ id, explicit: false }));
  }
  return [{ id: preference, explicit: true }];
}

export function getWebSearchProvider(id: WebSearchProviderId): WebSearchProvider {
  return PROVIDERS[id];
}

export function readProviderApiKey(
  id: WebSearchProviderId,
  config: WebSearchConfig | undefined,
  env: NodeJS.Dict<string | undefined>,
  _explicit: boolean,
): string | undefined {
  return webSearchProviderKey(id, config, env);
}

export function providerCredentialHint(id: WebSearchProviderId): string {
  return WEB_SEARCH_PROVIDER_ENV_KEYS[id];
}

export function listProviderIds(): readonly WebSearchProviderId[] {
  return WEB_SEARCH_PROVIDER_IDS;
}
