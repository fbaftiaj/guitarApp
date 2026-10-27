export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, n)));
}

/**
 * In-place iterative radix-2 complex FFT. Tables are built once per size and
 * transforms never allocate, so instances are safe to use on the audio thread.
 */
export class FFT {
  readonly size: number;
  private readonly cosTable: Float64Array;
  private readonly sinTable: Float64Array;
  private readonly bitReversed: Uint32Array;

  constructor(size: number) {
    if (!isPowerOfTwo(size) || size < 2) {
      throw new RangeError(`FFT size must be a power of two ≥ 2, got ${size}`);
    }
    this.size = size;
    this.cosTable = new Float64Array(size / 2);
    this.sinTable = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cosTable[i] = Math.cos((2 * Math.PI * i) / size);
      this.sinTable[i] = Math.sin((2 * Math.PI * i) / size);
    }
    const bits = Math.log2(size);
    this.bitReversed = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let reversed = 0;
      for (let bit = 0; bit < bits; bit++) reversed |= ((i >> bit) & 1) << (bits - 1 - bit);
      this.bitReversed[i] = reversed;
    }
  }

  /** Forward transform: X[k] = Σ x[n]·e^(−2πikn/N). */
  forward(re: Float64Array, im: Float64Array): void {
    this.transform(re, im, -1);
  }

  /** Inverse transform, including the 1/N scale. */
  inverse(re: Float64Array, im: Float64Array): void {
    this.transform(re, im, 1);
    const scale = 1 / this.size;
    for (let i = 0; i < this.size; i++) {
      re[i] = (re[i] ?? 0) * scale;
      im[i] = (im[i] ?? 0) * scale;
    }
  }

  private transform(re: Float64Array, im: Float64Array, sign: 1 | -1): void {
    const n = this.size;
    if (re.length < n || im.length < n) throw new RangeError(`Buffers must hold ${n} values`);
    const { cosTable, sinTable, bitReversed } = this;

    for (let i = 0; i < n; i++) {
      const j = bitReversed[i] ?? 0;
      if (j > i) {
        const r = re[i] ?? 0;
        re[i] = re[j] ?? 0;
        re[j] = r;
        const m = im[i] ?? 0;
        im[i] = im[j] ?? 0;
        im[j] = m;
      }
    }

    for (let length = 2; length <= n; length <<= 1) {
      const half = length >> 1;
      const step = n / length;
      for (let start = 0; start < n; start += length) {
        for (let k = 0; k < half; k++) {
          const wr = cosTable[k * step] ?? 0;
          const wi = sign * (sinTable[k * step] ?? 0);
          const a = start + k;
          const b = a + half;
          const br = re[b] ?? 0;
          const bi = im[b] ?? 0;
          const tr = wr * br - wi * bi;
          const ti = wr * bi + wi * br;
          const ar = re[a] ?? 0;
          const ai = im[a] ?? 0;
          re[b] = ar - tr;
          im[b] = ai - ti;
          re[a] = ar + tr;
          im[a] = ai + ti;
        }
      }
    }
  }
}
