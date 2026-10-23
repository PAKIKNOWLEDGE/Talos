import { describe, expect, it, vi } from 'vitest';

import {
  createManagedLocalWebSearchClient,
  MISSING_WEB_SEARCH_PROVIDER_MESSAGE,
} from '../../src/web-search/index.js';

const ctx = { sessionId: 'search-session', turnId: 'search-turn' };

describe('LocalWebSearchClient', () => {
  it('returns a missing-credential error when no backend is configured', async () => {
    const client = createManagedLocalWebSearchClient({
      env: {},
      fetchImpl: vi.fn<typeof fetch>(),
    });
    const result = await client.search(ctx, { query: 'latest node lts' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain(MISSING_WEB_SEARCH_PROVIDER_MESSAGE);
    expect(result.details).toMatchObject({ provider: 'none' });
  });

  it('names the missing credential for an explicit provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createManagedLocalWebSearchClient({
      config: { provider: 'exa' },
      env: {},
      fetchImpl,
    });
    const result = await client.search(ctx, { query: 'exa query' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.text).toContain('/settings');
    expect(result.text).toContain('Exa');
    expect(result.text).not.toMatch(/matrix/i);
  });

  it('uses a Tavily key saved in config.yaml without env', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ title: 'Config Hit', url: 'https://tavily.example', content: 'from config' }],
        }),
        { status: 200 },
      ),
    );
    const client = createManagedLocalWebSearchClient({
      config: { provider: 'tavily', tavilyApiKey: 'tvly-from-settings' },
      env: {},
      fetchImpl,
    });
    const result = await client.search(ctx, { query: 'from settings' });
    expect(result.details).toMatchObject({ provider: 'tavily' });
    expect(new Headers(fetchImpl.mock.calls[0]![1]?.headers).get('authorization')).toBe(
      'Bearer tvly-from-settings',
    );
  });

  it('uses Tavily when auto finds TAVILY_API_KEY', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ title: 'Tavily Hit', url: 'https://tavily.example', content: 'snippet' }],
        }),
        { status: 200 },
      ),
    );
    const client = createManagedLocalWebSearchClient({
      config: { provider: 'auto' },
      env: { TAVILY_API_KEY: 'tvly-test' },
      fetchImpl,
    });
    const result = await client.search(ctx, { query: 'search query' });
    expect(result.isError).not.toBe(true);
    expect(result.text).toContain('Tavily Hit');
    expect(result.text).toContain('https://tavily.example');
    expect(result.details).toMatchObject({ provider: 'tavily' });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://api.tavily.com/search');
  });

  it('skips Tavily in auto and uses Exa when only EXA_API_KEY is set', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ title: 'Exa Hit', url: 'https://exa.example', text: 'neural snippet' }],
        }),
        { status: 200 },
      ),
    );
    const client = createManagedLocalWebSearchClient({
      env: { EXA_API_KEY: 'exa-test' },
      fetchImpl,
    });
    const result = await client.search(ctx, { query: 'neural search' });
    expect(result.details).toMatchObject({ provider: 'exa' });
    expect(result.text).toContain('Exa Hit');
    expect(String(fetchImpl.mock.calls[0]![0])).toBe('https://api.exa.ai/search');
  });

  it('uses DeepSeek REST search when that backend is selected', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ title: 'DeepSeek Hit', url: 'https://deepseek.example', snippet: 'rest' }],
        }),
        { status: 200 },
      ),
    );
    const client = createManagedLocalWebSearchClient({
      config: { provider: 'deepseek' },
      env: { DEEPSEEK_API_KEY: 'sk-deepseek-test' },
      fetchImpl,
    });
    const result = await client.search(ctx, { query: 'deepseek search' });
    expect(result.details).toMatchObject({ provider: 'deepseek' });
    expect(result.text).toContain('DeepSeek Hit');
    const [url, request] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://api.deepseek.com/v1/tools/search');
    expect(new Headers(request?.headers).get('authorization')).toBe('Bearer sk-deepseek-test');
  });

  it('falls through auto when the first backend fails', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ title: 'Exa Fallback', url: 'https://exa.example' }],
          }),
          { status: 200 },
        ),
      );
    const client = createManagedLocalWebSearchClient({
      env: { TAVILY_API_KEY: 'tvly-bad', EXA_API_KEY: 'exa-test' },
      fetchImpl,
    });
    const result = await client.search(ctx, { query: 'fallback' });
    expect(result.isError).not.toBe(true);
    expect(result.details).toMatchObject({ provider: 'exa' });
    expect(result.text).toContain('Exa Fallback');
  });
});
