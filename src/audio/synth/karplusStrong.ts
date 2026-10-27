import { seededRandom } from './random';

export interface PluckOptions {
  frequency: number;
  sampleRate: number;
  durationSeconds: number;
  /** 0 = dull (nylon-like) … 1 = bright (new steel strings). */
  brightness?: number;
  /** Seconds for the tone to fade by 60 dB. */
  decaySeconds?: number;
  /** Where the string is plucked, as a fraction of its length (0.1 near the bridge … 0.5 middle). */
  pickPosition?: number;
  /** Peak output level, 0–1. */
  level?: number;
  /** Seeds the pluck noise; the same seed renders identical samples. */
  seed?: number;
}

const FADE_OUT_SECONDS = 0.05;

/**
 * Renders a plucked string with the Karplus–Strong algorithm, extended with
 * the Jaffe–Smith first-order allpass so the pitch is exact rather than
 * rounded to a whole-sample delay. The loop delay is N samples + 0.5 (the
 * two-point averaging filter, linear phase) + Δ (allpass).
 */
export function renderPluck({
  frequency,
  sampleRate,
  durationSeconds,
  brightness = 0.6,
  decaySeconds = 4,
  pickPosition = 0.18,
  level = 0.8,
  seed = 1,
}: PluckOptions): Float32Array<ArrayBuffer> {
  const period = sampleRate / frequency;
  // Keep Δ within [0.1, 1.1): the allpass is accurate and well-behaved there.
  const delay = Math.floor(period - 0.6);
  if (delay < 4) throw new RangeError(`${frequency} Hz is too high to pluck at ${sampleRate} Hz`);
  const fraction = period - 0.5 - delay;
  const allpassCoefficient = (1 - fraction) / (1 + fraction);
  const loopGain = 10 ** (-3 / (decaySeconds * frequency));

  // Excitation: one period of low-passed noise with a pick-position comb.
  const random = seededRandom(seed);
  const excitation = new Float64Array(delay);
  const smoothing = 0.92 * (1 - Math.min(1, Math.max(0, brightness)));
  let filtered = 0;
  for (let i = 0; i < delay; i++) {
    filtered = (1 - smoothing) * (random() * 2 - 1) + smoothing * filtered;
    excitation[i] = filtered;
  }
  const pickDelay = Math.max(1, Math.round(pickPosition * delay));
  for (let i = delay - 1; i >= pickDelay; i--) {
    excitation[i] = (excitation[i] ?? 0) - (excitation[i - pickDelay] ?? 0);
  }
  let mean = 0;
  for (const value of excitation) mean += value;
  mean /= delay;

  const length = Math.max(1, Math.round(durationSeconds * sampleRate));
  const output = new Float32Array(length);
  let previousAverage = 0;
  let previousAllpass = 0;
  let peak = 0;
  for (let n = 0; n < length; n++) {
    const average = 0.5 * ((output[n - delay] ?? 0) + (output[n - delay - 1] ?? 0));
    const allpass =
      allpassCoefficient * average + previousAverage - allpassCoefficient * previousAllpass;
    previousAverage = average;
    previousAllpass = allpass;
    const input = n < delay ? (excitation[n] ?? 0) - mean : 0;
    const sample = input + loopGain * allpass;
    output[n] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const scale = peak > 0 ? level / peak : 0;
  const fadeStart = Math.max(0, length - Math.round(FADE_OUT_SECONDS * sampleRate));
  for (let n = 0; n < length; n++) {
    const fade = n < fadeStart ? 1 : (length - 1 - n) / Math.max(1, length - 1 - fadeStart);
    output[n] = (output[n] ?? 0) * scale * fade;
  }
  return output;
}
