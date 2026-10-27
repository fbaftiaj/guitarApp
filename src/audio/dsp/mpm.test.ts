// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { centsBetween, midiToFrequency, parseNote } from '@/lib/music/notes';
import { harmonicTone, sawtooth, sine, whiteNoise } from '@/test/signals';
import { renderPluck } from '../synth/karplusStrong';
import { McLeodPitchDetector } from './mpm';

const GUITAR_NOTES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4'];
const SAMPLE_RATES = [44_100, 48_000];

function hz(note: string): number {
  return midiToFrequency(parseNote(note).midi);
}

function guitarDetector(sampleRate: number) {
  return new McLeodPitchDetector({
    sampleRate,
    windowSize: 2048,
    minFrequency: 50,
    maxFrequency: 1400,
  });
}

function bassDetector(sampleRate: number) {
  return new McLeodPitchDetector({
    sampleRate,
    windowSize: 4096,
    minFrequency: 27,
    maxFrequency: 500,
  });
}

/** Cents error of the detector on `signal`, analysing from `offset`. */
function centsError(
  detector: McLeodPitchDetector,
  signal: Float32Array,
  expected: number,
  offset = 0,
) {
  const estimate = detector.detect(signal, offset);
  if (!estimate) throw new Error('no pitch detected');
  return { cents: centsBetween(estimate.frequency, expected), clarity: estimate.clarity };
}

const cases = SAMPLE_RATES.flatMap((sampleRate) =>
  GUITAR_NOTES.map((note) => ({ note, sampleRate })),
);

describe('McLeodPitchDetector accuracy', () => {
  it.each(cases)('pure sine at $note, $sampleRate Hz: within ±1 cent', ({ note, sampleRate }) => {
    const detector = guitarDetector(sampleRate);
    // Several start phases, because peak interpolation error depends on phase.
    for (const phase of [0, 1.1, 2.3, 4.0]) {
      const signal = sine({ frequency: hz(note), sampleRate, length: 2048, phase });
      const { cents, clarity } = centsError(detector, signal, hz(note));
      expect(Math.abs(cents)).toBeLessThanOrEqual(1);
      expect(clarity).toBeGreaterThan(0.99);
    }
  });

  it.each(cases)(
    'band-limited sawtooth at $note, $sampleRate Hz: within ±3 cents',
    ({ note, sampleRate }) => {
      const detector = guitarDetector(sampleRate);
      const signal = sawtooth({ frequency: hz(note), sampleRate, length: 2048, phase: 0.7 });
      const { cents, clarity } = centsError(detector, signal, hz(note));
      expect(Math.abs(cents)).toBeLessThanOrEqual(3);
      expect(clarity).toBeGreaterThan(0.9);
    },
  );

  it.each(cases)(
    'Karplus–Strong pluck at $note, $sampleRate Hz: within ±3 cents',
    ({ note, sampleRate }) => {
      const detector = guitarDetector(sampleRate);
      const signal = renderPluck({ frequency: hz(note), sampleRate, durationSeconds: 0.5 });
      // Analyse shortly after the attack, as a tuner does while the string rings.
      for (const startSeconds of [0.05, 0.15, 0.3]) {
        const offset = Math.round(startSeconds * sampleRate);
        const { cents, clarity } = centsError(detector, signal, hz(note), offset);
        expect(Math.abs(cents)).toBeLessThanOrEqual(3);
        expect(clarity).toBeGreaterThan(0.9);
      }
    },
  );

  it.each(SAMPLE_RATES)('detects bass B0 and E1 within ±1 cent at %i Hz', (sampleRate) => {
    const detector = bassDetector(sampleRate);
    for (const note of ['B0', 'E1', 'A1']) {
      const signal = sine({ frequency: hz(note), sampleRate, length: 4096, phase: 0.4 });
      expect(Math.abs(centsError(detector, signal, hz(note)).cents)).toBeLessThanOrEqual(1);
    }
  });

  it.each(SAMPLE_RATES)('detects a plucked bass B0 within ±3 cents at %i Hz', (sampleRate) => {
    const detector = bassDetector(sampleRate);
    const signal = renderPluck({ frequency: hz('B0'), sampleRate, durationSeconds: 0.6 });
    const offset = Math.round(0.1 * sampleRate);
    expect(Math.abs(centsError(detector, signal, hz('B0'), offset).cents)).toBeLessThanOrEqual(3);
  });
});

describe('McLeodPitchDetector robustness', () => {
  const sampleRate = 48_000;
  const detector = guitarDetector(sampleRate);

  it('finds the fundamental when it is missing from the spectrum (small phone speakers/mics)', () => {
    for (const note of ['E2', 'A2']) {
      const signal = harmonicTone(
        { frequency: hz(note), sampleRate, length: 2048 },
        [0, 1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1],
      );
      expect(Math.abs(centsError(detector, signal, hz(note)).cents)).toBeLessThanOrEqual(3);
    }
  });

  it('does not jump an octave up when the second harmonic dominates', () => {
    for (const note of ['E2', 'A2', 'D3']) {
      const signal = harmonicTone(
        { frequency: hz(note), sampleRate, length: 2048, phase: 0.3 },
        [0.3, 1, 0.5, 0.25, 0.15],
      );
      expect(Math.abs(centsError(detector, signal, hz(note)).cents)).toBeLessThanOrEqual(3);
    }
  });

  it('ignores a DC offset', () => {
    const signal = sine({ frequency: hz('A2'), sampleRate, length: 2048 }).map((x) => x + 0.3);
    expect(Math.abs(centsError(detector, signal, hz('A2')).cents)).toBeLessThanOrEqual(1);
  });

  it('reports low clarity for noise', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const estimate = detector.detect(whiteNoise(2048, seed));
      expect(estimate === null || estimate.clarity < 0.9).toBe(true);
    }
  });

  it('returns nothing for silence', () => {
    expect(detector.detect(new Float32Array(2048))).toBeNull();
  });

  it('rejects tones above the range instead of reporting a lower octave', () => {
    const signal = sine({ frequency: 2000, sampleRate, length: 2048 });
    expect(detector.detect(signal)).toBeNull();
  });

  it('refuses a window too short for its lowest frequency', () => {
    expect(
      () =>
        new McLeodPitchDetector({
          sampleRate,
          windowSize: 1024,
          minFrequency: 30,
          maxFrequency: 500,
        }),
    ).toThrow(RangeError);
  });
});
