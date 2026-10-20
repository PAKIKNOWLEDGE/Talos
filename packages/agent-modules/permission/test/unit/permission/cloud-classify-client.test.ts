import { describe, expect, it } from 'vitest';

import { shouldUseCloudClassify } from '../../../src/classifier/cloud-classify-client.js';

describe('auto-mode classifier gating', () => {
  it('always consults the injected LLM judge; MiniMax mavis is not a gate', () => {
    expect(shouldUseCloudClassify()).toBe(true);
  });
});
