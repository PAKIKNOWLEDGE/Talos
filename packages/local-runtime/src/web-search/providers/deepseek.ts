import type { WebSearchHit, WebSearchProvider, WebSearchProviderRequest } from '../types.js';
import { asRecord, combineSignals, postJson, readString } from '../http.js';

const DEFAULT_DEEPSEEK_SEARCH_URL = 'https://api.deepseek.com/v1/tools/search';
const DEFAULT_NUM_RESULTS = 10;
const MAX_NUM_RESULTS = 20;

export const deepseekProvider: WebSearchProvider = {
  id: 'deepseek',
  label: 'DeepSeek',
  async search(request) {
    const count = clampCount(request.input.count);
    const payload = asRecord(
      await postJson(
        'deepseek',
        deepseekSearchUrl(),
        {
          query: request.input.query,
          max_results: count,
        },
        { authorization: `Bearer ${request.apiKey}` },
        request.fetchImpl,
        combineSignals(request.signal, request.timeoutMs),
      ),
    );
    const hits = readHits(extractHitList(payload)).slice(0, count);
    return { provider: 'deepseek', hits };
  },
};

function deepseekSearchUrl(): string {
  const base = process.env.DEEPSEEK_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) return DEFAULT_DEEPSEEK_SEARCH_URL;
  return `${base}/v1/tools/search`;
}

function clampCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return DEFAULT_NUM_RESULTS;
  return Math.min(MAX_NUM_RESULTS, Math.max(1, Math.floor(count)));
}

function extractHitList(payload: Record<string, unknown> | null): unknown {
  if (!payload) return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.search_results)) return payload.search_results;
  const nested = asRecord(payload.data);
  if (Array.isArray(nested?.results)) return nested.results;
  return [];
}

function readHits(value: unknown): WebSearchHit[] {
  if (!Array.isArray(value)) return [];
  const hits: WebSearchHit[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const url = readString(record?.url) ?? readString(record?.link);
    if (!url) continue;
    hits.push({
      title: readString(record?.title) ?? url,
      url,
      ...(readString(record?.snippet) || readString(record?.content) || readString(record?.summary)
        ? {
            snippet:
              readString(record?.snippet) ??
              readString(record?.content) ??
              readString(record?.summary),
          }
        : {}),
    });
  }
  return hits;
}
