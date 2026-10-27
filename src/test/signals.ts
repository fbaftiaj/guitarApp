import { seededRandom } from '@/audio/synth/random';

/** Synthetic test signals for the pitch detector. */

interface ToneOptions {
  frequency: number;
  sampleRate: number;
  length: number;
  amplitude?: number;
  /** Start phase of the fundamental, in radians. */
  phase?: number;
}

export function sine({ frequency, sampleRate, length, amplitude = 0.5, phase = 0 }: ToneOptions) {
  const w = (2 * Math.PI * frequency) / sampleRate;
  return Float32Array.from({ length }, (_, n) => amplitude * Math.sin(w * n + phase));
}

/**
 * Sum of harmonics k·f with the given amplitudes (index 0 = fundamental),
 * skipping partials at or above 95 % of Nyquist so the signal is band-limited.
 */
export function harmonicTone(
  { frequency, sampleRate, length, amplitude = 0.5, phase = 0 }: ToneOptions,
  amplitudes: readonly number[],
): Float32Array {
  const output = new Float32Array(length);
  const nyquist = sampleRate / 2;
  const total = amplitudes.reduce((sum, a) => sum + Math.abs(a), 0) || 1;
  amplitudes.forEach((a, index) => {
    const k = index + 1;
    if (a === 0 || k * frequency >= 0.95 * nyquist) return;
    const w = (2 * Math.PI * k * frequency) / sampleRate;
    for (let n = 0; n < length; n++) {
      output[n] = (output[n] ?? 0) + ((amplitude * a) / total) * Math.sin(w * n + k * phase);
    }
  });
  return output;
}

/** Band-limited sawtooth: every harmonic up to Nyquist at amplitude 1/k. */
export function sawtooth(options: ToneOptions): Float32Array {
  const count = Math.floor((0.95 * options.sampleRate) / 2 / options.frequency);
  return harmonicTone(
    options,
    Array.from({ length: count }, (_, i) => 1 / (i + 1)),
  );
}

export function whiteNoise(length: number, seed: number, amplitude = 0.5): Float32Array {
  const random = seededRandom(seed);
  return Float32Array.from({ length }, () => amplitude * (random() * 2 - 1));
}

/**
 * Reference frequency estimate for tests: the peak of a Hann-windowed DFT
 * magnitude near `approximate`, found coarse-to-fine (independent of the
 * MPM detector under test).
 */
export function spectralPeakFrequency(
  signal: Float32Array,
  sampleRate: number,
  approximate: number,
  { spanCents = 30 } = {},
): number {
  const n = signal.length;
  const windowed = Float64Array.from(
    { length: n },
    (_, i) => (signal[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))),
  );
  const power = (frequency: number) => {
    const w = (2 * Math.PI * frequency) / sampleRate;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += (windowed[i] ?? 0) * Math.cos(w * i);
      im -= (windowed[i] ?? 0) * Math.sin(w * i);
    }
    return re * re + im * im;
  };
  const scan = (low: number, high: number, step: number) => {
    let best = low;
    let bestPower = -1;
    for (let f = low; f <= high; f += step) {
      const p = power(f);
      if (p > bestPower) {
        bestPower = p;
        best = f;
      }
    }
    return best;
  };
  let best = scan(
    approximate * 2 ** (-spanCents / 1200),
    approximate * 2 ** (spanCents / 1200),
    0.1,
  );
  best = scan(best - 0.15, best + 0.15, 0.005);
  return scan(best - 0.006, best + 0.006, 0.0005);
}
