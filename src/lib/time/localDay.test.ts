// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { addDays, localDay } from './localDay';

describe('localDay', () => {
  it('formats the local calendar day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 0, 0).getTime())).toBe('2026-12-31');
  });

  it('moves across months, years and leap days', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-28', 0)).toBe('2026-10-28');
  });
});
