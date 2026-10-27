// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { centsBetween } from '@/lib/music/notes';
import { sine } from '@/test/signals';
import { StreamingPitchAnalyzer, analysisSettings, type PitchFrame } from './pitchAnalyzer';

const GUITAR = { minFrequency: 50, maxFrequency: 1400 };
const BASS = { minFrequency: 27, maxFrequency: 500 };

/** Feeds `signal` in 128-sample render quanta, like an AudioWorklet does. */
function run(analyzer: StreamingPitchAnalyzer, signal: Float32Array, sampleRate: number) {
  const frames: PitchFrame[] = [];
  for (let start = 0; start < signal.length; start += 128) {
    analyzer.push(signal.subarray(start, start + 128), start / sampleRate, (frame) =>
      frames.push(frame),
    );
  }
  return frames;
}

describe('analysisSettings', () => {
  it.each([
    [48_000, GUITAR, 2048, 512],
    [44_100, GUITAR, 2048, 512],
    [96_000, GUITAR, 4096, 1024],
    [48_000, BASS, 4096, 1024],
    [44_100, BASS, 4096, 1024],
  ])('at %i Hz uses window/hop sizes that fit the range', (sampleRate, range, window, hop) => {
    expect(analysisSettings(sampleRate, range)).toEqual({ windowSize: window, hopSize: hop });
  });
});

describe('StreamingPitchAnalyzer', () => {
  const sampleRate = 48_000;

  it('emits one frame per hop once the window is full, stamped with the window end time', () => {
    const analyzer = new StreamingPitchAnalyzer(sampleRate, GUITAR);
    const frames = run(analyzer, sine({ frequency: 110, sampleRate, length: 4096 }), sampleRate);

    // Frames end at samples 2048, 2560, 3072, 3584 and 4096.
    expect(frames.map((frame) => Math.round(frame.time * sampleRate))).toEqual([
      2048, 2560, 3072, 3584, 4096,
    ]);
  });

  it('tracks a tone delivered in render quanta', () => {
    const analyzer = new StreamingPitchAnalyzer(sampleRate, GUITAR);
    const frames = run(analyzer, sine({ frequency: 196, sampleRate, length: 8192 }), sampleRate);

    for (const frame of frames) {
      expect(Math.abs(centsBetween(frame.frequency, 196))).toBeLessThan(0.1);
      expect(frame.clarity).toBeGreaterThan(0.99);
      expect(frame.rms).toBeCloseTo(0.5 / Math.SQRT2, 2);
    }
  });

  it('reports silence without a pitch', () => {
    const analyzer = new StreamingPitchAnalyzer(sampleRate, GUITAR);
    const frames = run(analyzer, new Float32Array(4096), sampleRate);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((frame) => frame.frequency === 0 && frame.rms === 0)).toBe(true);
  });

  it('follows a change of note', () => {
    const analyzer = new StreamingPitchAnalyzer(sampleRate, GUITAR);
    const first = sine({ frequency: 110, sampleRate, length: 6144 });
    const second = sine({ frequency: 146.83, sampleRate, length: 6144 });
    const signal = new Float32Array(12_288);
    signal.set(first);
    signal.set(second, 6144);

    const frames = run(analyzer, signal, sampleRate);
    const last = frames.at(-1);

    expect(last && Math.abs(centsBetween(last.frequency, 146.83))).toBeLessThan(0.5);
  });
});
