// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { harmonicTone, sine } from '@/test/signals';
import { StreamingChroma, chromaSettings, computeChroma, type ChromaEvent } from './chroma';
import { MagnitudeSpectrum } from './spectrum';

const SAMPLE_RATE = 48_000;
const A = 9;

function chromaOfWindow(signal: Float32Array, a4 = 440): number[] {
  const { fftSize } = chromaSettings(SAMPLE_RATE);
  const spectrum = new MagnitudeSpectrum(fftSize);
  const magnitudes = spectrum.computeFromRing(signal.subarray(0, fftSize), 0);
  return Array.from(computeChroma(magnitudes, SAMPLE_RATE, fftSize, new Float64Array(12), a4));
}

function strongest(chroma: readonly number[]): number {
  return chroma.indexOf(Math.max(...chroma));
}

describe('computeChroma', () => {
  it('puts a pure A in the A bin', () => {
    const chroma = chromaOfWindow(sine({ frequency: 220, sampleRate: SAMPLE_RATE, length: 4096 }));
    expect(strongest(chroma)).toBe(A);
    expect(chroma[A]).toBeGreaterThan(0.99);
  });

  it('folds overtones into their pitch classes', () => {
    // A2 with harmonics: A, A, E (3rd), A, C# (5th).
    const tone = harmonicTone(
      { frequency: 110, sampleRate: SAMPLE_RATE, length: 4096 },
      [1, 0.5, 0.33, 0.25, 0.2],
    );
    const chroma = chromaOfWindow(tone);
    expect(strongest(chroma)).toBe(A);
    expect(chroma[4]).toBeGreaterThan(0.2); // E
    expect(chroma[1]).toBeGreaterThan(0.1); // C#
    expect(chroma[0]).toBeLessThan(0.05); // C
  });

  it('removes an overall tuning offset', () => {
    // A tuned 30 cents sharp still reads as A.
    const sharp = 220 * 2 ** (30 / 1200);
    const chroma = chromaOfWindow(
      sine({ frequency: sharp, sampleRate: SAMPLE_RATE, length: 4096 }),
    );
    expect(chroma[A]).toBeGreaterThan(0.99);
  });

  it('is all zero for silence', () => {
    expect(chromaOfWindow(new Float32Array(4096))).toEqual(new Array<number>(12).fill(0));
  });
});

describe('StreamingChroma', () => {
  function run(signal: Float32Array, onsets: number[], captureAfter = 0): ChromaEvent[] {
    const analysis = new StreamingChroma(SAMPLE_RATE);
    const events: ChromaEvent[] = [];
    const startTime = 2;
    for (let i = 0; i < signal.length; i += 128) {
      const time = startTime + i / SAMPLE_RATE;
      analysis.push(signal.subarray(i, i + 128), time, (event) => events.push(event));
      // Onsets are reported a little after they happen, as by the onset detector.
      for (const onset of onsets) {
        if (time <= onset + captureAfter && onset + captureAfter < time + 128 / SAMPLE_RATE) {
          analysis.capture(onset);
        }
      }
    }
    return events;
  }

  it('emits one chroma per onset, once the window after it has arrived', () => {
    const tone = sine({ frequency: 220, sampleRate: SAMPLE_RATE, length: SAMPLE_RATE });
    const events = run(tone, [2.1, 2.4], 0.015);
    expect(events.map((e) => e.onsetTime)).toEqual([2.1, 2.4]);
    expect(strongest(events[0]?.chroma ?? [])).toBe(A);
  });

  it('skips an onset reported too late to analyse', () => {
    const tone = sine({ frequency: 220, sampleRate: SAMPLE_RATE, length: SAMPLE_RATE });
    expect(run(tone, [2.1], 0.4)).toEqual([]);
  });
});
