// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatCents } from './format';

describe('formatCents', () => {
  it('rounds and signs the offset with a typographic minus', () => {
    expect(formatCents(-12.4)).toBe('−12 ¢');
    expect(formatCents(3.6)).toBe('+4 ¢');
    expect(formatCents(0.4)).toBe('0 ¢');
    expect(formatCents(-0.4)).toBe('0 ¢');
  });
});
