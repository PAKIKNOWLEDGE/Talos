import type { WebSearchHit, WebSearchProvider, WebSearchProviderRequest } from '../types.js';
import { asRecord, combineSignals, postJson, readString } from '../http.js';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const DEFAULT_NUM_RESULTS = 10;
const MAX_NUM_RESULTS = 20;

export const tavilyProvider: WebSearchProvider = {
  id: 'tavily',
  label: 'Tavily',
  async search(request) {
    const count = clampCount(request.input.count);
    const payload = asRecord(
      await postJson(
        'tavily',
        TAVILY_SEARCH_URL,
        {
          query: request.input.query,
          search_depth: 'basic',
          max_results: count,
          include_answer: 'advanced',
          include_raw_content: false,
          ...(request.input.search_type === 'news' ? { topic: 'news' } : {}),
          ...(isTavilyRecency(request.input.freshness) ? { time_range: request.input.freshness } : {}),
        },
        { authorization: `Bearer ${request.apiKey}` },
        request.fetchImpl,
        combineSignals(request.signal, request.timeoutMs),
      ),
    );
    const hits = readHits(payload?.results).slice(0, count);
    return {
      provider: 'tavily',
      hits,
      ...(readString(payload?.answer) ? { answer: readString(payload?.answer) } : {}),
    };
  },
};

function clampCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return DEFAULT_NUM_RESULTS;
  return Math.min(MAX_NUM_RESULTS, Math.max(1, Math.floor(count)));
}

function isTavilyRecency(value: string | undefined): value is 'day' | 'week' | 'month' | 'year' {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year';
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
      ...(readString(record?.content) || readString(record?.snippet)
        ? { snippet: readString(record?.content) ?? readString(record?.snippet) }
        : {}),
    });
  }
  return hits;
}
