import { describe, expect, it } from 'vitest';

import { LocalMavisCronValidationError, parseOnceRunAtMs } from './cron-schedule-input.js';

describe('cron once after durations', () => {
  const now = 1_700_000_000_000;

  it('accepts a week and a week plus days', () => {
    expect(parseOnceRunAtMs({ after: '1w' }, now)).toBe(now + 604_800_000);
    expect(parseOnceRunAtMs({ after: '1w2d' }, now)).toBe(now + 604_800_000 + 2 * 86_400_000);
  });

  it('still rejects a missing unit', () => {
    expect(() => parseOnceRunAtMs({ after: '1' }, now)).toThrow(LocalMavisCronValidationError);
  });
});
