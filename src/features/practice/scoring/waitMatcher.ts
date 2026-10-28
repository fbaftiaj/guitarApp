import type { ChromaEvent } from '@/audio/dsp/chroma';
import type { Onset } from '@/audio/dsp/onsetDetector';
import type { PitchFrame } from '@/audio/dsp/pitchAnalyzer';
import { HitCheck, type Expected } from './hitCheck';

/** Playing slightly before the timeline reaches the chord still counts. */
const EARLY_SECONDS = 0.15;

/**
 * Wait mode: listens for the awaited chord or note. Every attempt (an onset)
 * is checked; `onAttempt` reports whether it was right, and a right one ends
 * the wait.
 */
export class WaitMatcher {
  private readonly a4: number;
  private readonly onAttempt: (correct: boolean) => void;
  private expected: Expected | null = null;
  private since = 0;
  private check: HitCheck | null = null;

  constructor({ a4, onAttempt }: { a4: number; onAttempt: (correct: boolean) => void }) {
    this.a4 = a4;
    this.onAttempt = onAttempt;
  }

  get waiting(): boolean {
    return this.expected !== null;
  }

  /** Starts waiting for `expected`, counting onsets from about `since` (audio clock). */
  wait(expected: Expected, since: number): void {
    this.expected = expected;
    this.since = since - EARLY_SECONDS;
    this.check = null;
  }

  clear(): void {
    this.expected = null;
    this.check = null;
  }

  addOnset(onset: Onset): void {
    if (!this.expected || onset.time < this.since) return;
    // A new strum replaces an attempt still being checked.
    this.check = new HitCheck(onset.time, this.expected, this.a4);
  }

  addChroma(event: ChromaEvent): void {
    this.resolve(this.check?.chroma(event));
  }

  addPitch(frame: PitchFrame): void {
    this.resolve(this.check?.pitch(frame));
  }

  update(now: number): void {
    this.resolve(this.check?.expire(now));
  }

  private resolve(result: boolean | null | undefined): void {
    if (result === null || result === undefined) return;
    this.check = null;
    if (result) this.clear();
    this.onAttempt(result);
  }
}
