import { describe, expect, it, vi } from 'vitest';

import { CodexModelDiscoveryClient } from './codex-model-discovery.js';

describe('Codex model discovery client version', () => {
  it('requests catalog client_version 0.162.0 and does not call a live model', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          models: [
            {
              slug: 'gpt-test',
              visibility: 'list',
              display_name: 'GPT Test',
              supported_reasoning_levels: [],
              input_modalities: ['text'],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const client = new CodexModelDiscoveryClient(fetchImpl as unknown as typeof fetch);
    await client.discover({ access: 'token', accountId: 'acct' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toContain('client_version=0.162.0');
    expect(url).not.toContain('client_version=0.153.0');
  });
});
