// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { centsBetween, midiToFrequency, parseNote } from '@/lib/music/notes';
import { spectralPeakFrequency } from '@/test/signals';
import { renderPluck } from './karplusStrong';

function rms(signal: Float32Array, start: number, length: number): number {
  let sum = 0;
  for (let i = start; i < start + length; i++) sum += (signal[i] ?? 0) ** 2;
  return Math.sqrt(sum / length);
}

describe('renderPluck', () => {
  const sampleRate = 48_000;

  it.each(['B0', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4'])(
    'is tuned to %s within ±0.5 cent (measured spectrally)',
    (note) => {
      const frequency = midiToFrequency(parseNote(note).midi);
      const signal = renderPluck({ frequency, sampleRate, durationSeconds: 1.5 });
      // Skip the attack; measure 1 s of the ringing string.
      const segment = signal.subarray(Math.round(0.2 * sampleRate), Math.round(1.2 * sampleRate));

      const measured = spectralPeakFrequency(segment, sampleRate, frequency);

      expect(Math.abs(centsBetween(measured, frequency))).toBeLessThanOrEqual(0.5);
    },
  );

  it('peaks at the requested level and fades out without a click', () => {
    const signal = renderPluck({ frequency: 110, sampleRate, durationSeconds: 1, level: 0.7 });
    const peak = signal.reduce((max, x) => Math.max(max, Math.abs(x)), 0);

    expect(peak).toBeCloseTo(0.7, 5);
    expect(signal.at(-1)).toBe(0);
    expect(signal.every(Number.isFinite)).toBe(true);
  });

  it('decays over time', () => {
    const signal = renderPluck({ frequency: 110, sampleRate, durationSeconds: 3, decaySeconds: 2 });
    const early = rms(signal, Math.round(0.1 * sampleRate), 4800);
    const late = rms(signal, Math.round(2.1 * sampleRate), 4800);

    // 2 s at T60 = 2 s is −60 dB; allow for the attack transient and filtering.
    expect(20 * Math.log10(late / early)).toBeLessThan(-40);
  });

  it('is repeatable for a seed and varies between seeds', () => {
    const options = { frequency: 196, sampleRate, durationSeconds: 0.2 };
    expect(renderPluck({ ...options, seed: 5 })).toEqual(renderPluck({ ...options, seed: 5 }));
    expect(renderPluck({ ...options, seed: 5 })).not.toEqual(renderPluck({ ...options, seed: 6 }));
  });

  it('sounds darker with lower brightness', () => {
    const highFrequencyEnergy = (signal: Float32Array) => {
      // Energy of the first difference approximates high-frequency content.
      let sum = 0;
      for (let i = 1; i < signal.length; i++) sum += ((signal[i] ?? 0) - (signal[i - 1] ?? 0)) ** 2;
      return sum;
    };
    const options = { frequency: 110, sampleRate, durationSeconds: 0.5, seed: 3 };
    expect(highFrequencyEnergy(renderPluck({ ...options, brightness: 0.2 }))).toBeLessThan(
      highFrequencyEnergy(renderPluck({ ...options, brightness: 0.9 })),
    );
  });

  it('rejects pitches too high for the sample rate', () => {
    expect(() => renderPluck({ frequency: 15_000, sampleRate, durationSeconds: 0.1 })).toThrow(
      RangeError,
    );
  });
});
