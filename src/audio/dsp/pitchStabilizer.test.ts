// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PitchFrame } from './pitchAnalyzer';
import { PitchStabilizer } from './pitchStabilizer';

const HOP = 0.01;

function frames(frequencies: (number | null)[], start = 0): PitchFrame[] {
  return frequencies.map((frequency, i) => ({
    time: start + i * HOP,
    frequency: frequency ?? 0,
    clarity: frequency === null ? 0 : 0.98,
    rms: frequency === null ? 0 : 0.1,
  }));
}

function outputs(stabilizer: PitchStabilizer, input: PitchFrame[]) {
  return input.map((frame) => stabilizer.push(frame));
}

describe('PitchStabilizer', () => {
  it('passes a steady pitch through', () => {
    expect(outputs(new PitchStabilizer(), frames([110, 110, 110]))).toEqual([110, 110, 110]);
  });

  it('gates out quiet, unclear and pitchless frames', () => {
    const stabilizer = new PitchStabilizer();
    const base = { time: 0, frequency: 110, clarity: 0.98, rms: 0.1 };

    expect(stabilizer.push({ ...base, clarity: 0.85 })).toBeNull();
    expect(stabilizer.push({ ...base, rms: 0.001 })).toBeNull();
    expect(stabilizer.push({ ...base, frequency: 0 })).toBeNull();
    expect(stabilizer.push(base)).toBe(110);
  });

  it('removes a single outlier with the median', () => {
    const result = outputs(new PitchStabilizer(), frames([110, 110, 110, 125, 110, 110]));
    expect(result.at(3)).toBe(110);
    expect(result.at(-1)).toBe(110);
  });

  it('smooths jitter by taking the median of the last five readings', () => {
    const result = outputs(new PitchStabilizer(), frames([110, 111, 109, 112, 108]));
    expect(result.at(-1)).toBe(110);
  });

  it('never shows a one-frame octave error', () => {
    const result = outputs(new PitchStabilizer(), frames([110, 220, 110, 55, 110]));
    expect(result).toEqual([110, 110, 110, 110, 110]);
  });

  it('accepts a real octave change once a second reading confirms it', () => {
    const result = outputs(new PitchStabilizer(), frames([110, 110, 220, 220, 220]));
    expect(result).toEqual([110, 110, 110, 220, 220]);
  });

  it('starts fresh after a pause, so a new note an octave away shows at once', () => {
    const stabilizer = new PitchStabilizer();
    outputs(stabilizer, frames([110, 110, 110]));

    const afterPause = outputs(stabilizer, frames([220, 220], 0.5));

    expect(afterPause).toEqual([220, 220]);
  });
});
