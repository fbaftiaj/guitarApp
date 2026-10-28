// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHORDS } from '@/content/chords';
import { mix, pluck, strum } from '@/test/guitarSignals';
import { sawtooth, whiteNoise } from '@/test/signals';
import { StreamingOnsetDetector, onsetSettings, type Onset } from './onsetDetector';

function detect(signal: Float32Array, sampleRate: number, blockSize = 128): Onset[] {
  const detector = new StreamingOnsetDetector(sampleRate);
  const onsets: Onset[] = [];
  for (let i = 0; i < signal.length; i += blockSize) {
    detector.push(signal.subarray(i, i + blockSize), i / sampleRate, (onset) => onsets.push(onset));
  }
  return onsets;
}

function midis(id: string): readonly (number | null)[] {
  return CHORDS.get(id)?.midis ?? [];
}

/** Every expected time has exactly one onset within ±tolerance, and nothing else is found. */
function expectOnsetsAt(onsets: readonly Onset[], times: readonly number[], tolerance = 0.008) {
  expect(onsets.map((o) => Number(o.time.toFixed(3)))).toHaveLength(times.length);
  times.forEach((time, i) => {
    expect(Math.abs((onsets[i]?.time ?? Infinity) - time), `onset ${i} at ${time}`).toBeLessThan(
      tolerance,
    );
  });
}

describe.each([44_100, 48_000])('StreamingOnsetDetector at %i Hz', (sampleRate) => {
  it('uses ~21 ms windows every ~5 ms', () => {
    const { windowSize, hopSize } = onsetSettings(sampleRate);
    expect(windowSize).toBe(1024);
    expect((hopSize / sampleRate) * 1000).toBeLessThan(6);
  });

  it('finds each strum of a chord progression, down and up, at its attack', () => {
    const plan = [
      { time: 0.5, chord: 'Em', direction: 'down' },
      { time: 1.0, chord: 'Em', direction: 'up' },
      { time: 1.25, chord: 'Em', direction: 'down' },
      { time: 1.5, chord: 'Am', direction: 'up' },
      { time: 1.75, chord: 'Am', direction: 'down' },
      { time: 2.25, chord: 'C', direction: 'down' },
      { time: 2.5, chord: 'G', direction: 'down' },
      { time: 2.75, chord: 'D', direction: 'up' },
    ] as const;
    const signal = mix(
      sampleRate,
      3.5,
      plan.map(({ time, chord, direction }, i) => ({
        time,
        signal: strum({ midis: midis(chord), sampleRate, direction, seed: 10 * i + 1 }),
      })),
      { noise: 0.002, damp: true },
    );
    expectOnsetsAt(
      detect(signal, sampleRate),
      plan.map((p) => p.time),
    );
  });

  it('treats a strum as one onset, even a slow one', () => {
    const signal = mix(sampleRate, 1.5, [
      { time: 0.4, signal: strum({ midis: midis('G'), sampleRate, spread: 0.015 }) },
    ]);
    expectOnsetsAt(detect(signal, sampleRate), [0.4]);
  });

  it('hears a strum half as loud as the one before', () => {
    const signal = mix(
      sampleRate,
      2,
      [
        { time: 0.3, signal: strum({ midis: midis('A'), sampleRate, level: 0.25 }) },
        { time: 0.8, signal: strum({ midis: midis('A'), sampleRate, level: 0.12, seed: 9 }) },
      ],
      { noise: 0.001 },
    );
    expectOnsetsAt(detect(signal, sampleRate), [0.3, 0.8]);
  });

  it('finds fast single notes, including repeated ones, without damping', () => {
    // Eighth notes at 200 BPM: 150 ms apart.
    const notes = [40, 40, 43, 45, 47, 45, 40, 40];
    const times = notes.map((_, i) => 0.3 + i * 0.15);
    const signal = mix(
      sampleRate,
      2,
      notes.map((midi, i) => ({
        time: times[i] ?? 0,
        signal: pluck(midi, sampleRate, { seed: i }),
      })),
      { noise: 0.001 },
    );
    expectOnsetsAt(detect(signal, sampleRate), times);
  });

  it('gives the same onsets whatever the block size', () => {
    const signal = mix(sampleRate, 1.5, [
      { time: 0.3, signal: strum({ midis: midis('E'), sampleRate }) },
      { time: 0.9, signal: strum({ midis: midis('Am'), sampleRate, direction: 'up' }) },
    ]);
    const small = detect(signal, sampleRate, 128).map((o) => o.time);
    const large = detect(signal, sampleRate, 1000).map((o) => o.time);
    expect(large).toHaveLength(small.length);
    large.forEach((time, i) => {
      expect(time).toBeCloseTo(small[i] ?? 0, 9);
    });
  });

  it.each([
    ['silence', () => new Float32Array(sampleRate * 2)],
    ['loud white noise (−34 dBFS)', () => whiteNoise(sampleRate * 2, 5, 0.02)],
    [
      'a steady tone',
      () => sawtooth({ frequency: 110, sampleRate, length: sampleRate * 2, amplitude: 0.3 }),
    ],
    [
      'a chord ringing out',
      () =>
        mix(
          sampleRate,
          3,
          [{ time: 0, signal: strum({ midis: midis('Em'), sampleRate, seconds: 3 }) }],
          {
            noise: 0.002,
          },
        ).subarray(Math.round(0.3 * sampleRate)),
    ],
  ])('stays quiet on %s', (_name, signal) => {
    // The first window of a signal that starts loud is not an attack the test cares about.
    const onsets = detect(signal(), sampleRate).filter((o) => o.time > 0.1);
    expect(onsets).toEqual([]);
  });
});
