import { centsBetween } from '@/lib/music/notes';
import type { PitchFrame } from './pitchAnalyzer';

export interface StabilizerOptions {
  /** Minimum MPM clarity for a frame to count as a pitch. */
  minClarity?: number;
  /** Noise gate: minimum RMS level (0.002 ≈ −54 dBFS). */
  minRms?: number;
  /** Number of recent readings the median is taken over. */
  medianSize?: number;
  /** A pause longer than this (seconds) starts a new note. */
  resetAfterSeconds?: number;
  /** How close to a whole octave (in cents) a jump must be to count as one. */
  octaveToleranceCents?: number;
}

const DEFAULTS: Required<StabilizerOptions> = {
  minClarity: 0.9,
  minRms: 0.002,
  medianSize: 5,
  resetAfterSeconds: 0.2,
  octaveToleranceCents: 60,
};

/**
 * Turns raw detector frames into a steady pitch reading:
 *
 * 1. Gate: frames below the clarity or level threshold are not a pitch.
 * 2. Octave protection: a reading one or two octaves away from the previous
 *    one is held back; it is only accepted if the next reading confirms it,
 *    so single-frame octave errors never reach the display.
 * 3. A median over the last readings removes remaining outliers.
 */
export class PitchStabilizer {
  private readonly options: Required<StabilizerOptions>;
  private readonly history: number[] = [];
  private readonly sorted: number[] = [];
  private lastAccepted: number | null = null;
  private pendingOctave: number | null = null;
  private lastPitchTime: number | null = null;

  constructor(options: StabilizerOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** True when the frame passes the clarity and level gates. */
  isPitched(frame: PitchFrame): boolean {
    return (
      frame.frequency > 0 &&
      frame.clarity >= this.options.minClarity &&
      frame.rms >= this.options.minRms
    );
  }

  /** Returns the stable frequency in Hz, or null when the frame is not a pitch. */
  push(frame: PitchFrame): number | null {
    if (!this.isPitched(frame)) return null;
    const { resetAfterSeconds, octaveToleranceCents } = this.options;

    if (this.lastPitchTime !== null && frame.time - this.lastPitchTime > resetAfterSeconds) {
      this.reset();
    }
    this.lastPitchTime = frame.time;

    const frequency = frame.frequency;
    if (
      this.lastAccepted !== null &&
      isOctaveJump(frequency, this.lastAccepted, octaveToleranceCents)
    ) {
      const confirmed =
        this.pendingOctave !== null &&
        Math.abs(centsBetween(frequency, this.pendingOctave)) <= octaveToleranceCents;
      if (!confirmed) {
        this.pendingOctave = frequency;
        return this.median();
      }
      // Two readings agree on the new octave: it is a real change of note.
      this.history.length = 0;
      this.history.push(this.pendingOctave ?? frequency);
    }
    this.pendingOctave = null;

    this.history.push(frequency);
    if (this.history.length > this.options.medianSize) this.history.shift();
    this.lastAccepted = frequency;
    return this.median();
  }

  reset(): void {
    this.history.length = 0;
    this.lastAccepted = null;
    this.pendingOctave = null;
    this.lastPitchTime = null;
  }

  private median(): number | null {
    const { history, sorted } = this;
    if (history.length === 0) return null;
    sorted.length = 0;
    sorted.push(...history);
    sorted.sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 === 1
      ? (sorted[middle] ?? null)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
}

function isOctaveJump(frequency: number, reference: number, tolerance: number): boolean {
  const jump = Math.abs(centsBetween(frequency, reference));
  return Math.abs(jump - 1200) <= tolerance || Math.abs(jump - 2400) <= tolerance;
}
