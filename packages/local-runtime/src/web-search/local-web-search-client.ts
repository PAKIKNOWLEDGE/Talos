import { type LocalWebSearchAdapter, type WebSearchInput } from '@mavis/agent-tools/desktop';
import type { ToolResult } from '@mavis/agent-core/tools';
import type { WebSearchConfig } from '@mavis/config';

import {
  formatSearchResults,
  MISSING_WEB_SEARCH_PROVIDER_MESSAGE,
  unavailableProviderMessage,
} from './format.js';
import { isAbortError } from './http.js';
import {
  getWebSearchProvider,
  providerCredentialHint,
  readProviderApiKey,
  resolveProviderCandidates,
  resolveWebSearchPreference,
} from './registry.js';
import {
  LOCAL_WEB_SEARCH_TIMEOUT_MS,
  WebSearchProviderError,
  type ResolveWebSearchOptions,
} from './types.js';

export { LOCAL_WEB_SEARCH_TIMEOUT_MS };

export type LocalWebSearchClientOptions = ResolveWebSearchOptions;

export class LocalWebSearchClient implements LocalWebSearchAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly config: WebSearchConfig | undefined;
  private readonly env: NodeJS.Dict<string | undefined>;

  constructor(options: LocalWebSearchClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.config = options.config;
    this.env = options.env ?? process.env;
  }

  async search(
    _ctx: unknown,
    input: WebSearchInput,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    if (signal?.aborted) {
      return searchErrorResult('Operation aborted', true);
    }
    const preference = resolveWebSearchPreference(this.config, this.env);
    const candidates = resolveProviderCandidates(preference);
    const failures: string[] = [];
    let availableProviderCount = 0;

    for (const candidate of candidates) {
      const provider = getWebSearchProvider(candidate.id);
      const apiKey = readProviderApiKey(candidate.id, this.config, this.env, candidate.explicit);
      if (!apiKey) {
        if (candidate.explicit) {
          return searchErrorResult(
            unavailableProviderMessage(provider.label, providerCredentialHint(candidate.id)),
          );
        }
        continue;
      }
      availableProviderCount += 1;
      try {
        const result = await provider.search({
          input,
          apiKey,
          fetchImpl: this.fetchImpl,
          timeoutMs: LOCAL_WEB_SEARCH_TIMEOUT_MS,
          ...(signal ? { signal } : {}),
        });
        if (result.hits.length === 0 && !result.answer?.trim()) {
          throw new WebSearchProviderError(provider.id, `${provider.label} returned no search results.`);
        }
        const text = formatSearchResults(result);
        return {
          tool_name: 'web_search',
          text,
          content: [{ type: 'text', text }],
          details: {
            provider: result.provider,
            hits: result.hits,
            ...(result.answer ? { answer: result.answer } : {}),
          },
        };
      } catch (error) {
        if (isAbortError(error)) {
          return searchErrorResult('Operation aborted', true);
        }
        failures.push(formatFailure(error, provider.label));
        if (candidate.explicit) {
          return searchErrorResult(failures[failures.length - 1]!);
        }
      }
    }

    if (availableProviderCount === 0) {
      return searchErrorResult(MISSING_WEB_SEARCH_PROVIDER_MESSAGE);
    }
    return searchErrorResult(
      failures.length > 1
        ? `All web search providers failed: ${failures.join('; ')}`
        : (failures[0] ?? MISSING_WEB_SEARCH_PROVIDER_MESSAGE),
    );
  }
}

export function createManagedLocalWebSearchClient(
  options: LocalWebSearchClientOptions = {},
): LocalWebSearchClient {
  return new LocalWebSearchClient(options);
}

function searchErrorResult(message: string, aborted = false): ToolResult {
  const text = message.startsWith('Error:') ? message : `Error: ${message}`;
  return {
    tool_name: 'web_search',
    text,
    content: [{ type: 'text', text }],
    isError: true,
    details: { provider: 'none', ...(aborted ? { aborted: true } : {}) },
  };
}

function formatFailure(error: unknown, label: string): string {
  if (error instanceof WebSearchProviderError) return error.message;
  if (error instanceof Error) return error.message;
  return `Unknown error from ${label}`;
}
