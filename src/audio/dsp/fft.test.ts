// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FFT, isPowerOfTwo, nextPowerOfTwo } from './fft';

function naiveDft(re: Float64Array, im: Float64Array): [Float64Array, Float64Array] {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      outRe[k] = (outRe[k] ?? 0) + (re[t] ?? 0) * Math.cos(angle) - (im[t] ?? 0) * Math.sin(angle);
      outIm[k] = (outIm[k] ?? 0) + (re[t] ?? 0) * Math.sin(angle) + (im[t] ?? 0) * Math.cos(angle);
    }
  }
  return [outRe, outIm];
}

function randomSignal(n: number, seed: number): Float64Array {
  let state = seed;
  return Float64Array.from({ length: n }, () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 30 - 1;
  });
}

describe('FFT', () => {
  it.each([2, 8, 64, 512])('matches a naive DFT for size %i', (size) => {
    const re = randomSignal(size, size);
    const im = randomSignal(size, size + 1);
    const [expectedRe, expectedIm] = naiveDft(re, im);

    new FFT(size).forward(re, im);

    for (let k = 0; k < size; k++) {
      expect(re[k]).toBeCloseTo(expectedRe[k] ?? NaN, 8);
      expect(im[k]).toBeCloseTo(expectedIm[k] ?? NaN, 8);
    }
  });

  it('inverts its own transform', () => {
    const size = 4096;
    const original = randomSignal(size, 7);
    const re = Float64Array.from(original);
    const im = new Float64Array(size);
    const fft = new FFT(size);

    fft.forward(re, im);
    fft.inverse(re, im);

    for (let i = 0; i < size; i++) {
      expect(re[i]).toBeCloseTo(original[i] ?? NaN, 10);
      expect(im[i]).toBeCloseTo(0, 10);
    }
  });

  it('rejects sizes that are not powers of two', () => {
    expect(() => new FFT(1000)).toThrow(RangeError);
    expect(() => new FFT(1)).toThrow(RangeError);
  });
});

describe('power-of-two helpers', () => {
  it('recognises and rounds up to powers of two', () => {
    expect([1, 2, 1024].every(isPowerOfTwo)).toBe(true);
    expect([0, 3, 1000, 1.5].some(isPowerOfTwo)).toBe(false);
    expect(nextPowerOfTwo(1000)).toBe(1024);
    expect(nextPowerOfTwo(1024)).toBe(1024);
    expect(nextPowerOfTwo(1025)).toBe(2048);
  });
});
