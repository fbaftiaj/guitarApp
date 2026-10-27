// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { whiteNoise } from '@/test/signals';
import { Autocorrelator } from './autocorrelation';

function naiveAutocorrelation(x: Float32Array, length: number, maxLag: number): number[] {
  return Array.from({ length: maxLag + 1 }, (_, lag) => {
    let sum = 0;
    for (let j = 0; j + lag < length; j++) sum += (x[j] ?? 0) * (x[j + lag] ?? 0);
    return sum;
  });
}

describe('Autocorrelator', () => {
  it.each([
    [16, 7],
    [100, 40],
    [2048, 960],
    [4096, 1778],
  ])('matches the naive autocorrelation for %i samples up to lag %i', (length, maxLag) => {
    const signal = whiteNoise(length, length);
    const out = new Float64Array(maxLag + 1);

    new Autocorrelator(length, maxLag).compute(signal, length, out);

    const expected = naiveAutocorrelation(signal, length, maxLag);
    for (let lag = 0; lag <= maxLag; lag++) {
      expect(out[lag]).toBeCloseTo(expected[lag] ?? NaN, 6);
    }
  });

  it('treats samples past `length` as silence', () => {
    const signal = whiteNoise(64, 3);
    const out = new Float64Array(11);

    new Autocorrelator(64, 10).compute(signal, 40, out);

    expect([...out].map((v) => v.toFixed(6))).toEqual(
      naiveAutocorrelation(signal, 40, 10).map((v) => v.toFixed(6)),
    );
  });
});
