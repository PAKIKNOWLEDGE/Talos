import { describe, expect, it } from 'vitest';

import { parseOnceRunAtMs } from '../../src/cron/once-time.js';

describe('local runtime cron once after durations', () => {
  const now = 1_700_000_000_000;

  it('accepts a week', () => {
    expect(parseOnceRunAtMs({ after: '1w' }, now)).toBe(now + 604_800_000);
    expect(parseOnceRunAtMs({ after: '1w2d' }, now)).toBe(now + 604_800_000 + 2 * 86_400_000);
  });
});
