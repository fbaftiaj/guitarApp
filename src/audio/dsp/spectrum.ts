import { FFT } from './fft';

/**
 * Magnitude spectrum of a Hann-windowed frame, normalised so a full-scale
 * sine (amplitude 1) peaks at about 1. Buffers are allocated once; `compute`
 * never allocates, so it is safe on the audio thread.
 */
export class MagnitudeSpectrum {
  readonly size: number;
  /** |X(k)| for k = 0 … size/2. */
  readonly magnitudes: Float64Array;
  private readonly fft: FFT;
  private readonly window: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(size: number) {
    this.size = size;
    this.fft = new FFT(size);
    this.window = Float64Array.from(
      { length: size },
      (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / size),
    );
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
    this.magnitudes = new Float64Array(size / 2 + 1);
  }

  /** Bin index nearest to `frequency` at `sampleRate`. */
  bin(frequency: number, sampleRate: number): number {
    return Math.round((frequency * this.size) / sampleRate);
  }

  /**
   * Analyses `size` samples of a ring buffer, oldest first, starting at
   * `start` (the ring's write position when it is full).
   */
  computeFromRing(ring: Float32Array, start: number): Float64Array {
    const { size, window, re, im } = this;
    for (let n = 0; n < size; n++) {
      re[n] = (ring[(start + n) % ring.length] ?? 0) * (window[n] ?? 0);
      im[n] = 0;
    }
    this.fft.forward(re, im);
    // Hann has coherent gain 1/2, so a sine of amplitude A peaks at A·N/4.
    const scale = 4 / size;
    for (let k = 0; k <= size / 2; k++) {
      this.magnitudes[k] = Math.hypot(re[k] ?? 0, im[k] ?? 0) * scale;
    }
    return this.magnitudes;
  }
}
