import { nextPowerOfTwo } from './fft';
import { MagnitudeSpectrum } from './spectrum';

/** A detected note or strum attack. */
export interface Onset {
  /** Audio-clock time (seconds) of the attack, as captured. */
  time: number;
  /** Height of the onset detection function at the peak (dimensionless). */
  strength: number;
}

export interface OnsetSettings {
  windowSize: number;
  hopSize: number;
}

/** ~21 ms windows every ~5 ms: fine timing for ±40 ms scoring windows. */
export function onsetSettings(sampleRate: number): OnsetSettings {
  const windowSize = nextPowerOfTwo(0.021 * sampleRate);
  return { windowSize, hopSize: windowSize / 4 };
}

/** Guitar attacks are strongest here; leaves out kick drums and hi-hats. */
const BAND_HZ = { min: 150, max: 5000 } as const;
/** Log compression: log(1 + γ·|X|). */
const COMPRESSION = 300;
/** Spectral flux compares with the frame this many hops back (sharper than adjacent frames). */
const FLUX_LAG = 2;
/** Adaptive threshold: mean of the recent detection function × ratio + floor. */
const THRESHOLD_SECONDS = 0.1;
const THRESHOLD_RATIO = 1.4;
const THRESHOLD_FLOOR = 0.05;
/** Frames just before a peak belong to the same attack: not part of the baseline. */
const THRESHOLD_SKIP = 2;
/** Frames quieter than this (RMS, about −54 dBFS) never start an onset. */
const LEVEL_GATE = 0.002;
/** Detection-function peak to attack, in hops (see `analyse`). */
const ATTACK_HOPS = 2.5;
/** A strum spreads its strings over ~60 ms: it is one onset. */
const MIN_INTERVAL_SECONDS = 0.07;

/**
 * Streaming onset detector: half-wave rectified spectral flux of the
 * log-compressed magnitude spectrum in 150 Hz–5 kHz, an adaptive threshold,
 * and peak picking one hop late. Reports onsets about 10–15 ms after the
 * attack, timestamped at the attack. Allocation-free after construction
 * apart from the emitted onsets.
 */
export class StreamingOnsetDetector {
  readonly settings: OnsetSettings;
  private readonly sampleRate: number;
  private readonly spectrum: MagnitudeSpectrum;
  private readonly ring: Float32Array;
  /** Log spectra of the last FLUX_LAG + 1 frames, back to back. */
  private readonly logSpectra: Float64Array;
  private readonly stride: number;
  private readonly minBin: number;
  private readonly maxBin: number;
  private readonly flux: Float64Array;
  private readonly frameTimes: Float64Array;
  private readonly frameLevels: Float64Array;
  private readonly scratch: Float64Array;
  private frames = 0;
  private writeIndex = 0;
  private filled = 0;
  private sinceLastFrame = 0;
  private lastOnsetTime = -Infinity;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.settings = onsetSettings(sampleRate);
    const { windowSize, hopSize } = this.settings;
    this.spectrum = new MagnitudeSpectrum(windowSize);
    this.ring = new Float32Array(windowSize);
    this.minBin = Math.max(1, this.spectrum.bin(BAND_HZ.min, sampleRate));
    this.maxBin = Math.min(windowSize / 2, this.spectrum.bin(BAND_HZ.max, sampleRate));
    this.stride = windowSize / 2 + 1;
    this.logSpectra = new Float64Array((FLUX_LAG + 1) * this.stride);
    const history = Math.max(4, Math.ceil((THRESHOLD_SECONDS * sampleRate) / hopSize) + 2);
    this.flux = new Float64Array(history);
    this.frameTimes = new Float64Array(history);
    this.frameLevels = new Float64Array(history);
    this.scratch = new Float64Array(history - THRESHOLD_SKIP - 3);
  }

  /** Feeds samples starting at `blockStartTime`; calls `emit` for each onset found. */
  push(block: Float32Array, blockStartTime: number, emit: (onset: Onset) => void): void {
    const { windowSize, hopSize } = this.settings;
    for (let i = 0; i < block.length; i++) {
      this.ring[this.writeIndex] = block[i] ?? 0;
      this.writeIndex = (this.writeIndex + 1) % windowSize;
      if (this.filled < windowSize) this.filled++;
      this.sinceLastFrame++;
      if (this.filled === windowSize && this.sinceLastFrame >= hopSize) {
        this.sinceLastFrame = 0;
        this.analyse(blockStartTime + (i + 1) / this.sampleRate, emit);
      }
    }
  }

  private analyse(endTime: number, emit: (onset: Onset) => void): void {
    const { windowSize } = this.settings;
    const magnitudes = this.spectrum.computeFromRing(this.ring, this.writeIndex);
    const frame = this.frames;
    const slots = FLUX_LAG + 1;
    const current = (frame % slots) * this.stride;
    // The slot written FLUX_LAG frames ago is the next one round.
    const previous = ((frame + 1) % slots) * this.stride;
    let flux = 0;
    for (let k = this.minBin; k <= this.maxBin; k++) {
      const value = Math.log1p(COMPRESSION * (magnitudes[k] ?? 0));
      if (frame >= FLUX_LAG) {
        // SuperFlux: compare with the louder neighbouring bin of the old frame, so
        // partials wobbling between bins (vibrato, window phase) are not attacks.
        const before = Math.max(
          this.logSpectra[previous + k - 1] ?? 0,
          this.logSpectra[previous + k] ?? 0,
          this.logSpectra[previous + k + 1] ?? 0,
        );
        flux += Math.max(0, value - before);
      }
      this.logSpectra[current + k] = value;
    }
    flux /= this.maxBin - this.minBin + 1;

    let sumOfSquares = 0;
    for (const sample of this.ring) sumOfSquares += sample * sample;
    const slot = frame % this.flux.length;
    this.flux[slot] = flux;
    // The flux peaks when the attack is about 2.5 hops behind the newest sample
    // (measured on synthesised plucks and strums, ±5 ms at 44.1 and 48 kHz).
    this.frameTimes[slot] = endTime - (ATTACK_HOPS * this.settings.hopSize) / this.sampleRate;
    this.frameLevels[slot] = Math.sqrt(sumOfSquares / windowSize);
    this.frames++;
    if (frame >= FLUX_LAG + 2) this.pick(frame - 1, emit);
  }

  /** Decides whether `frame` (one hop old) is an onset: a local peak above the threshold. */
  private pick(frame: number, emit: (onset: Onset) => void): void {
    const size = this.flux.length;
    const at = (f: number) => this.flux[((f % size) + size) % size] ?? 0;
    const value = at(frame);
    if (!(value > at(frame - 1) && value >= at(frame + 1))) return;
    const slot = frame % size;
    if (
      (this.frameLevels[slot] ?? 0) < LEVEL_GATE &&
      (this.frameLevels[(frame + 1) % size] ?? 0) < LEVEL_GATE
    ) {
      return;
    }
    // Median of the recent past, leaving out the attack's own leading frames.
    const recent = this.scratch;
    for (let i = 0; i < recent.length; i++) recent[i] = at(frame - THRESHOLD_SKIP - 1 - i);
    recent.sort();
    const median = recent[recent.length >> 1] ?? 0;
    if (value < THRESHOLD_FLOOR + THRESHOLD_RATIO * median) return;
    const time = this.frameTimes[slot] ?? 0;
    if (time - this.lastOnsetTime < MIN_INTERVAL_SECONDS) return;
    this.lastOnsetTime = time;
    emit({ time, strength: value });
  }
}
