import { FFT, nextPowerOfTwo } from './fft';

/**
 * Linear autocorrelation r(τ) = Σⱼ x[j]·x[j+τ] of a real signal, computed as
 * IFFT(|FFT(x)|²) with the signal zero-padded so the circular correlation
 * equals the linear one.
 *
 * Both transforms exploit the real input: N real samples are packed into
 * N/2 complex values (even samples → real part, odd → imaginary), which
 * halves the FFT cost. Buffers are allocated once; `compute` never allocates.
 */
export class Autocorrelator {
  readonly maxLength: number;
  readonly maxLag: number;
  private readonly size: number;
  private readonly half: number;
  private readonly fft: FFT;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly power: Float64Array;
  private readonly cosTable: Float64Array;
  private readonly sinTable: Float64Array;

  constructor(maxLength: number, maxLag: number) {
    this.maxLength = maxLength;
    this.maxLag = maxLag;
    this.size = Math.max(4, nextPowerOfTwo(maxLength + maxLag + 1));
    this.half = this.size / 2;
    this.fft = new FFT(this.half);
    this.re = new Float64Array(this.half);
    this.im = new Float64Array(this.half);
    this.power = new Float64Array(this.half + 1);
    this.cosTable = new Float64Array(this.half);
    this.sinTable = new Float64Array(this.half);
    for (let k = 0; k < this.half; k++) {
      this.cosTable[k] = Math.cos((2 * Math.PI * k) / this.size);
      this.sinTable[k] = Math.sin((2 * Math.PI * k) / this.size);
    }
  }

  /**
   * Writes r(0 … maxLag) of `input[0 … length)` into `out` (which must hold
   * maxLag + 1 values).
   */
  compute(input: ArrayLike<number>, length: number, out: Float64Array): void {
    const { half, re, im, power, cosTable, sinTable, fft } = this;
    if (length > this.maxLength) throw new RangeError(`Input longer than ${this.maxLength}`);

    // Pack: z[m] = x[2m] + i·x[2m+1], zero-padded.
    for (let m = 0; m < half; m++) {
      const even = 2 * m;
      re[m] = even < length ? (input[even] ?? 0) : 0;
      im[m] = even + 1 < length ? (input[even + 1] ?? 0) : 0;
    }
    fft.forward(re, im);

    // Unpack to the spectrum X[k] = E[k] + W^k·O[k] of the real signal and
    // keep its power |X[k]|² for k = 0 … N/2 (the rest mirrors it).
    for (let k = 0; k <= half; k++) {
      const a = k % half;
      const b = (half - k) % half;
      const zr = re[a] ?? 0;
      const zi = im[a] ?? 0;
      const cr = re[b] ?? 0;
      const ci = -(im[b] ?? 0); // conj(Z[N/2 − k])
      const evenRe = 0.5 * (zr + cr);
      const evenIm = 0.5 * (zi + ci);
      // O[k] = (Z[k] − conj(Z[N/2−k])) / 2i
      const oddRe = 0.5 * (zi - ci);
      const oddIm = -0.5 * (zr - cr);
      // W^k = e^(−2πik/N); for k = N/2 it is −1.
      const wr = k < half ? (cosTable[k] ?? 0) : -1;
      const wi = k < half ? -(sinTable[k] ?? 0) : 0;
      const xr = evenRe + wr * oddRe - wi * oddIm;
      const xi = evenIm + wr * oddIm + wi * oddRe;
      power[k] = xr * xr + xi * xi;
    }

    // Inverse of a real, even spectrum P: with E[k] = (P[k] + P[N/2−k]) / 2 and
    // O[k] = (P[k] − P[N/2−k]) / (2·W^k), z = IFFT(E + i·O) holds r at even
    // lags in its real part and odd lags in its imaginary part.
    for (let k = 0; k < half; k++) {
      const p = power[k] ?? 0;
      const q = power[half - k] ?? 0;
      const even = 0.5 * (p + q);
      const diff = 0.5 * (p - q);
      const c = cosTable[k] ?? 0;
      const s = sinTable[k] ?? 0;
      re[k] = even - diff * s;
      im[k] = diff * c;
    }
    fft.inverse(re, im);

    for (let lag = 0; lag <= this.maxLag; lag++) {
      const m = lag >> 1;
      out[lag] = (lag & 1) === 0 ? (re[m] ?? 0) : (im[m] ?? 0);
    }
  }
}
