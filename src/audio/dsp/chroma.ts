import { nextPowerOfTwo } from './fft';
import { MagnitudeSpectrum } from './spectrum';

/**
 * Chroma (pitch-class profile) of a sound right after an onset: the 12
 * pitch classes C … B with the energy of the spectral peaks folded into
 * them. Chord recognition compares this with chord templates.
 */

export const PITCH_CLASSES = 12;
/** E2 (82 Hz) up to where guitar partials stay strong and resolvable. */
const BAND_HZ = { min: 75, max: 2000 } as const;
/** Log compression of peak magnitudes, so no single partial dominates. */
const COMPRESSION = 300;
/** Peaks more than 40 dB below the loudest are leakage or noise. */
const RELATIVE_FLOOR = 0.01;
const ABSOLUTE_FLOOR = 1e-5;

export interface ChromaSettings {
  /** FFT size: ~85 ms at 44.1/48 kHz, fine enough to separate low notes' partials. */
  fftSize: number;
  /** Skips the pick noise at the start of the attack. */
  delaySeconds: number;
}

export function chromaSettings(sampleRate: number): ChromaSettings {
  return { fftSize: nextPowerOfTwo(0.08 * sampleRate), delaySeconds: 0.01 };
}

const MAX_PEAKS = 256;
/** Scratch space for the peaks of one frame (the audio thread must not allocate). */
const peakPitches = new Float64Array(MAX_PEAKS);
const peakWeights = new Float64Array(MAX_PEAKS);

/**
 * Folds the spectral peaks of `magnitudes` (bins 0 … size/2 of a `size`-point
 * spectrum) into `out` (12 values, unit length; all zero when there are no
 * peaks). Peak frequencies are refined by parabolic interpolation. The
 * overall tuning offset (an instrument tuned slightly sharp or flat of `a4`)
 * is estimated from the peaks and removed, then each peak counts less the
 * further it is from an equal-tempered pitch.
 */
export function computeChroma(
  magnitudes: Float64Array,
  sampleRate: number,
  size: number,
  out: Float64Array,
  a4 = 440,
): Float64Array {
  out.fill(0);
  const minBin = Math.max(2, Math.floor((BAND_HZ.min * size) / sampleRate));
  const maxBin = Math.min(size / 2 - 2, Math.ceil((BAND_HZ.max * size) / sampleRate));
  let loudest = 0;
  for (let k = minBin; k <= maxBin; k++) loudest = Math.max(loudest, magnitudes[k] ?? 0);
  const floor = Math.max(ABSOLUTE_FLOOR, loudest * RELATIVE_FLOOR);

  let peaks = 0;
  let tuningX = 0;
  let tuningY = 0;
  for (let k = minBin; k <= maxBin && peaks < MAX_PEAKS; k++) {
    const peak = magnitudes[k] ?? 0;
    const left = magnitudes[k - 1] ?? 0;
    const right = magnitudes[k + 1] ?? 0;
    if (peak < floor || peak <= left || peak < right) continue;
    const a = Math.log(left + 1e-12);
    const b = Math.log(peak);
    const c = Math.log(right + 1e-12);
    const curvature = a - 2 * b + c;
    const offset = curvature < 0 ? (0.5 * (a - c)) / curvature : 0;
    const frequency = ((k + offset) * sampleRate) / size;
    const pitch = 69 + 12 * Math.log2(frequency / a4);
    const weight = Math.log1p(COMPRESSION * peak);
    peakPitches[peaks] = pitch;
    peakWeights[peaks] = weight;
    peaks++;
    // Deviations from the semitone grid, averaged as angles (−50 and +50 cents meet).
    const angle = 2 * Math.PI * (pitch - Math.round(pitch));
    tuningX += weight * Math.cos(angle);
    tuningY += weight * Math.sin(angle);
  }
  const tuning = peaks > 0 ? Math.atan2(tuningY, tuningX) / (2 * Math.PI) : 0;

  for (let i = 0; i < peaks; i++) {
    const pitch = (peakPitches[i] ?? 0) - tuning;
    const nearest = Math.round(pitch);
    const closeness = Math.max(0, 1 - 2 * Math.abs(pitch - nearest));
    const pitchClass = ((nearest % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
    out[pitchClass] = (out[pitchClass] ?? 0) + (peakWeights[i] ?? 0) * closeness;
  }

  let norm = 0;
  for (const value of out) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < PITCH_CLASSES; i++) out[i] = (out[i] ?? 0) / norm;
  return out;
}

export interface ChromaEvent {
  /** The onset this chroma belongs to. */
  onsetTime: number;
  chroma: number[];
}

const MAX_PENDING = 8;
/** How far back an onset can be (detection delay) and still be captured. */
const HISTORY_SECONDS = 0.15;

/**
 * Captures the chroma of the sound after each onset from a stream. Call
 * `capture(onsetTime)` when an onset is detected; once the analysis window
 * after it has arrived, `push` emits its chroma.
 */
export class StreamingChroma {
  readonly settings: ChromaSettings;
  private readonly sampleRate: number;
  private readonly a4: number;
  private readonly spectrum: MagnitudeSpectrum;
  private readonly ring: Float32Array;
  private readonly chroma = new Float64Array(PITCH_CLASSES);
  private readonly pending: number[] = [];
  /** Samples written so far; the ring holds the most recent ones. */
  private written = 0;
  private firstSampleTime = 0;

  constructor(sampleRate: number, a4 = 440) {
    this.sampleRate = sampleRate;
    this.a4 = a4;
    this.settings = chromaSettings(sampleRate);
    this.spectrum = new MagnitudeSpectrum(this.settings.fftSize);
    this.ring = new Float32Array(this.settings.fftSize + Math.ceil(HISTORY_SECONDS * sampleRate));
  }

  capture(onsetTime: number): void {
    if (this.pending.length < MAX_PENDING) this.pending.push(onsetTime);
  }

  push(block: Float32Array, blockStartTime: number, emit: (event: ChromaEvent) => void): void {
    if (this.written === 0) this.firstSampleTime = blockStartTime;
    for (const sample of block) {
      this.ring[this.written % this.ring.length] = sample;
      this.written++;
    }
    const { fftSize, delaySeconds } = this.settings;
    while (this.pending.length > 0) {
      const onsetTime = this.pending[0] ?? 0;
      const start = Math.round((onsetTime + delaySeconds - this.firstSampleTime) * this.sampleRate);
      if (start + fftSize > this.written) break;
      this.pending.shift();
      // Too old to still be in the ring (or before the stream began): skip it.
      if (start < this.written - this.ring.length || start < 0) continue;
      const magnitudes = this.spectrum.computeFromRing(this.ring, start % this.ring.length);
      computeChroma(magnitudes, this.sampleRate, fftSize, this.chroma, this.a4);
      emit({ onsetTime, chroma: Array.from(this.chroma) });
    }
  }
}
