import type {
  WebSearchConfig,
  WebSearchProviderId,
} from '@mavis/config';
import type { WebSearchInput } from '@mavis/agent-tools/desktop';

export type { WebSearchProviderId };

export interface WebSearchHit {
  title: string;
  url: string;
  snippet?: string;
}

export interface WebSearchProviderResult {
  provider: WebSearchProviderId;
  hits: WebSearchHit[];
  answer?: string;
}

export interface WebSearchProviderRequest {
  input: WebSearchInput;
  apiKey: string;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface WebSearchProvider {
  readonly id: WebSearchProviderId;
  readonly label: string;
  search(request: WebSearchProviderRequest): Promise<WebSearchProviderResult>;
}

export class WebSearchProviderError extends Error {
  constructor(
    readonly provider: WebSearchProviderId | 'none',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WebSearchProviderError';
  }
}

export interface ResolveWebSearchOptions {
  config?: WebSearchConfig;
  env?: NodeJS.Dict<string | undefined>;
  fetchImpl?: typeof fetch;
}

export const LOCAL_WEB_SEARCH_TIMEOUT_MS = 60_000;
