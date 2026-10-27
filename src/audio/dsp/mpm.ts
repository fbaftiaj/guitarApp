import { Autocorrelator } from './autocorrelation';

/**
 * McLeod Pitch Method (P. McLeod & G. Wyvill, "A Smarter Way to Find Pitch",
 * ICMC 2005).
 *
 * The normalised square difference function (NSDF) of a window peaks at 1
 * at lags equal to the period. Unlike FFT peak picking it does not lock onto
 * a strong harmonic, and the peak height doubles as a "clarity" (confidence)
 * score: ~1 for a clean periodic tone, low for noise.
 *
 * The autocorrelation inside the NSDF is computed with an FFT, so one estimate
 * costs O(N log N). All buffers are allocated up front: `detect` never
 * allocates, which keeps it safe to run on the audio thread.
 */

export interface PitchEstimate {
  /** Fundamental frequency in Hz. */
  frequency: number;
  /** Height of the chosen NSDF peak, 0–1; above ~0.9 means a clear pitch. */
  clarity: number;
}

export interface McLeodOptions {
  sampleRate: number;
  /** Samples per analysis window; must span at least two periods of `minFrequency`. */
  windowSize: number;
  minFrequency: number;
  maxFrequency: number;
  /**
   * MPM's "k": the first NSDF peak reaching this fraction of the highest peak
   * is taken as the period. Lower values risk octave-up errors on tones with
   * a strong second harmonic; higher values risk octave-down errors.
   */
  peakThreshold?: number;
}

const DEFAULT_PEAK_THRESHOLD = 0.9;

export class McLeodPitchDetector {
  readonly sampleRate: number;
  readonly windowSize: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  private readonly peakThreshold: number;
  private readonly maxLag: number;
  private readonly autocorrelator: Autocorrelator;
  private readonly centered: Float64Array;
  private readonly correlation: Float64Array;
  private readonly nsdf: Float64Array;
  private readonly peaks: Int32Array;

  constructor({
    sampleRate,
    windowSize,
    minFrequency,
    maxFrequency,
    peakThreshold = DEFAULT_PEAK_THRESHOLD,
  }: McLeodOptions) {
    if (!(minFrequency > 0 && maxFrequency > minFrequency)) {
      throw new RangeError('Need 0 < minFrequency < maxFrequency');
    }
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.minFrequency = minFrequency;
    this.maxFrequency = maxFrequency;
    this.peakThreshold = peakThreshold;
    this.maxLag = Math.ceil(sampleRate / minFrequency);
    if (windowSize < 2 * this.maxLag) {
      throw new RangeError(
        `A ${windowSize}-sample window is too short for ${minFrequency} Hz; need ≥ ${2 * this.maxLag}`,
      );
    }
    this.autocorrelator = new Autocorrelator(windowSize, this.maxLag + 1);
    this.centered = new Float64Array(windowSize);
    this.correlation = new Float64Array(this.maxLag + 2);
    this.nsdf = new Float64Array(this.maxLag + 2);
    this.peaks = new Int32Array(this.maxLag + 2);
  }

  /**
   * Estimates the pitch of `samples[offset … offset + windowSize)`.
   * Returns null when the window has no periodic peak in range (e.g. silence).
   */
  detect(samples: ArrayLike<number>, offset = 0): PitchEstimate | null {
    const { windowSize, centered, correlation, nsdf } = this;
    const lagLimit = this.maxLag + 1;

    let mean = 0;
    for (let i = 0; i < windowSize; i++) mean += samples[offset + i] ?? 0;
    mean /= windowSize;

    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      const x = (samples[offset + i] ?? 0) - mean;
      centered[i] = x;
      energy += x * x;
    }
    if (energy === 0) return null;

    this.autocorrelator.compute(centered, windowSize, correlation);

    // NSDF n(τ) = 2·r(τ) / m(τ), with m(τ) = Σ x[j]² + x[j+τ]² over the overlap,
    // updated incrementally as the overlap shrinks.
    let m = 2 * energy;
    for (let lag = 0; lag <= lagLimit; lag++) {
      nsdf[lag] = m > 0 ? (2 * (correlation[lag] ?? 0)) / m : 0;
      const head = centered[lag] ?? 0;
      const tail = centered[windowSize - 1 - lag] ?? 0;
      m -= head * head + tail * tail;
    }

    const peakCount = this.findKeyMaxima();
    if (peakCount === 0) return null;

    let highest = 0;
    for (let i = 0; i < peakCount; i++) highest = Math.max(highest, nsdf[this.peaks[i] ?? 0] ?? 0);
    const threshold = this.peakThreshold * highest;

    for (let i = 0; i < peakCount; i++) {
      const lag = this.peaks[i] ?? 0;
      if ((nsdf[lag] ?? 0) < threshold) continue;
      const peak = this.interpolate(lag);
      const frequency = this.sampleRate / this.refine(peak.position, peak.value);
      if (frequency < this.minFrequency || frequency > this.maxFrequency) return null;
      return { frequency, clarity: Math.min(1, peak.value) };
    }
    return null;
  }

  /** Parabolic interpolation through an NSDF peak and its neighbours. */
  private interpolate(lag: number): { position: number; value: number } {
    const a = this.nsdf[lag - 1] ?? 0;
    const b = this.nsdf[lag] ?? 0;
    const c = this.nsdf[lag + 1] ?? 0;
    const curvature = a - 2 * b + c;
    const shift = curvature < 0 ? (0.5 * (a - c)) / curvature : 0;
    return { position: lag + shift, value: b - 0.25 * (a - c) * shift };
  }

  /**
   * The NSDF of a periodic tone also peaks at whole multiples of the period.
   * Interpolating the highest multiple in range spreads the sub-sample
   * interpolation error over that many periods, which sharpens high notes
   * (whose period spans few samples) for harmonically rich tones.
   */
  private refine(period: number, clarity: number): number {
    const multiple = Math.floor((this.maxLag - 1) / period);
    if (multiple < 2) return period;
    const expected = multiple * period;
    const centre = Math.round(expected);
    let best = centre;
    for (let lag = centre - 2; lag <= centre + 2; lag++) {
      if (lag >= 1 && lag <= this.maxLag && (this.nsdf[lag] ?? 0) > (this.nsdf[best] ?? 0)) {
        best = lag;
      }
    }
    const peak = this.interpolate(best);
    // Trust the multiple only if it is as clear as the first peak and where expected.
    if (peak.value < 0.95 * clarity || Math.abs(peak.position - expected) > 1) return period;
    return peak.position / multiple;
  }

  /**
   * Collects the highest NSDF value of each positive lobe after the first
   * negative-going zero crossing (the lag-0 lobe is skipped). Returns how
   * many lags were written to `this.peaks`.
   *
   * Lobes at lags shorter than `maxFrequency` allows are kept on purpose: a
   * tone above the range must be rejected, not reported an octave lower.
   */
  private findKeyMaxima(): number {
    const { nsdf, peaks, maxLag } = this;
    let count = 0;
    let lag = 1;
    while (lag <= maxLag && (nsdf[lag] ?? 0) > 0) lag++;

    while (lag <= maxLag) {
      while (lag <= maxLag && (nsdf[lag] ?? 0) <= 0) lag++;
      if (lag > maxLag) break;
      let best = lag;
      while (lag <= maxLag && (nsdf[lag] ?? 0) > 0) {
        if ((nsdf[lag] ?? 0) > (nsdf[best] ?? 0)) best = lag;
        lag++;
      }
      // A lobe cut off by maxLag counts only if its maximum is a true peak.
      const isPeak = (nsdf[best] ?? 0) >= (nsdf[best + 1] ?? 0);
      if (isPeak) peaks[count++] = best;
    }
    return count;
  }
}
