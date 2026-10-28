import { renderPluck } from '@/audio/synth/karplusStrong';
import { midiToFrequency } from '@/lib/music/notes';
import { whiteNoise } from './signals';

/** Synthetic guitar playing for the onset and chord tests: plucks, strums and mixes. */

export interface StrumOptions {
  /** MIDI note per string, 6th string first; null = not played. */
  midis: readonly (number | null)[];
  sampleRate: number;
  direction?: 'down' | 'up';
  /** Seconds between strings. */
  spread?: number;
  /** Peak level of each string. */
  level?: number;
  seconds?: number;
  brightness?: number;
  seed?: number;
}

export function pluck(
  midi: number,
  sampleRate: number,
  { level = 0.3, seconds = 2, brightness = 0.7, seed = 1 } = {},
): Float32Array {
  return renderPluck({
    frequency: midiToFrequency(midi),
    sampleRate,
    durationSeconds: seconds,
    level,
    brightness,
    seed,
  });
}

export function strum({
  midis,
  sampleRate,
  direction = 'down',
  spread = 0.012,
  level = 0.2,
  seconds = 2,
  brightness = 0.7,
  seed = 1,
}: StrumOptions): Float32Array {
  let strings = midis.flatMap((midi) => (midi === null ? [] : [midi]));
  if (direction === 'up') strings = strings.slice(-4).reverse();
  const output = new Float32Array(Math.round((seconds + 0.1) * sampleRate));
  strings.forEach((midi, i) => {
    const offset = Math.round(i * spread * sampleRate);
    const note = pluck(midi, sampleRate, { level, seconds, brightness, seed: seed + i });
    for (let n = 0; n < note.length && offset + n < output.length; n++) {
      output[offset + n] = (output[offset + n] ?? 0) + (note[n] ?? 0);
    }
  });
  return output;
}

/**
 * Mixes signals into one track at the given start times, with an optional
 * noise floor. A later sound cuts the previous one short when `damp` is set,
 * like a strum replacing the last one on a real guitar.
 */
export function mix(
  sampleRate: number,
  seconds: number,
  parts: readonly { time: number; signal: Float32Array }[],
  { noise = 0, damp = false, seed = 99 } = {},
): Float32Array {
  const length = Math.round(seconds * sampleRate);
  const output = noise > 0 ? whiteNoise(length, seed, noise) : new Float32Array(length);
  const sorted = [...parts].sort((a, b) => a.time - b.time);
  sorted.forEach(({ time, signal }, i) => {
    const start = Math.round(time * sampleRate);
    const next = sorted[i + 1];
    const stop = damp && next ? Math.round(next.time * sampleRate) - start : signal.length;
    const fade = Math.round(0.01 * sampleRate);
    for (let n = 0; n < Math.min(signal.length, stop + fade) && start + n < length; n++) {
      const gain = n < stop ? 1 : 1 - (n - stop) / fade;
      output[start + n] = (output[start + n] ?? 0) + (signal[n] ?? 0) * gain;
    }
  });
  return output;
}
