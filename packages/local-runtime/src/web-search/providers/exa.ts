import type { WebSearchHit, WebSearchProvider, WebSearchProviderRequest } from '../types.js';
import { asRecord, combineSignals, postJson, readString } from '../http.js';

const EXA_SEARCH_URL = 'https://api.exa.ai/search';
const DEFAULT_NUM_RESULTS = 10;
const MAX_NUM_RESULTS = 20;

export const exaProvider: WebSearchProvider = {
  id: 'exa',
  label: 'Exa',
  async search(request) {
    const count = clampCount(request.input.count);
    const payload = asRecord(
      await postJson(
        'exa',
        EXA_SEARCH_URL,
        {
          query: request.input.query,
          numResults: count,
          type: 'auto',
          contents: { text: { maxCharacters: 400 } },
          ...(startPublishedDate(request.input.freshness)
            ? { startPublishedDate: startPublishedDate(request.input.freshness) }
            : {}),
        },
        { 'x-api-key': request.apiKey },
        request.fetchImpl,
        combineSignals(request.signal, request.timeoutMs),
      ),
    );
    return {
      provider: 'exa',
      hits: readHits(payload?.results).slice(0, count),
    };
  },
};

function clampCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return DEFAULT_NUM_RESULTS;
  return Math.min(MAX_NUM_RESULTS, Math.max(1, Math.floor(count)));
}

function startPublishedDate(freshness: string | undefined): string | undefined {
  const days =
    freshness === 'day' ? 1 : freshness === 'week' ? 7 : freshness === 'month' ? 30 : freshness === 'year' ? 365 : 0;
  if (days <= 0) return undefined;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function readHits(value: unknown): WebSearchHit[] {
  if (!Array.isArray(value)) return [];
  const hits: WebSearchHit[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const url = readString(record?.url) ?? readString(record?.id);
    if (!url) continue;
    const text = asRecord(record?.text);
    hits.push({
      title: readString(record?.title) ?? url,
      url,
      ...(readString(record?.text) || readString(text?.text) || readString(record?.summary)
        ? {
            snippet:
              readString(record?.text) ?? readString(text?.text) ?? readString(record?.summary),
          }
        : {}),
    });
  }
  return hits;
}
