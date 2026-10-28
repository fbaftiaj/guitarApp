import type { ChromaEvent } from '@/audio/dsp/chroma';
import type { Onset } from '@/audio/dsp/onsetDetector';
import type { PitchFrame } from '@/audio/dsp/pitchAnalyzer';
import { HitCheck, type Expected } from './hitCheck';
import { TIMING_CREDIT, TIMING_WINDOWS, classifyTiming, type Timing } from './timing';

/** One scheduled occurrence of something to play (a strum or a note, in one pass). */
export interface ScoringTarget {
  /** Unique per occurrence. */
  id: number;
  /** Strum or note index in the timeline, for marking it on screen. */
  index: number;
  pass: number;
  /** Audio-clock time at which it sounds. */
  time: number;
  expected: Expected;
  /** Chord or note name, for the "most missed" list. */
  label: string;
  /** The first strum of a new chord (scored for the chord-changes skill). */
  change: boolean;
}

export interface Hit {
  target: ScoringTarget;
  timing: Timing;
  /** Onset minus target time in seconds, latency removed; null for a miss. */
  deviation: number | null;
  /** Right chord or note; null while it is still being checked. */
  correct: boolean | null;
  /** No more changes will come. */
  final: boolean;
}

export interface ScorerOptions {
  /** Seconds between a target sounding and its onset being heard when played on time. */
  latency: number;
  a4: number;
  /** Called when a hit is first judged (timing) and again when it is final. */
  onHit?: (hit: Hit) => void;
}

/** Judged targets still considered when deciding which target an onset belongs to. */
const RECENT = 4;
/** Extra wait for an onset to come through the analysis before calling a miss. */
const DETECTION_SECONDS = 0.05;

interface Pending {
  target: ScoringTarget;
  hit: Hit | null;
  check: HitCheck | null;
}

export function hitCredit(hit: Pick<Hit, 'timing' | 'correct'>): number {
  return hit.correct === true ? TIMING_CREDIT[hit.timing] : 0;
}

/**
 * Matches what is heard (onsets, then chroma or pitch) to the targets as they
 * are scheduled, and judges each one: Perfect / Good / Early / Late by
 * timing, right or wrong chord or note, or Miss when nothing was played.
 */
export class Scorer {
  private readonly options: ScorerOptions;

  private pending: Pending[] = [];
  private finished: Hit[] = [];

  constructor(options: ScorerOptions) {
    this.options = options;
  }

  get hits(): readonly Hit[] {
    return this.finished;
  }

  /** Changes the latency removed from onset times (e.g. once the audio output is known). */
  setLatency(seconds: number): void {
    this.options.latency = seconds;
  }

  /** Targets must be added in time order (as the transport schedules them). */
  addTarget(target: ScoringTarget): void {
    this.pending.push({ target, hit: null, check: null });
  }

  addOnset(onset: Onset): void {
    const heard = onset.time - this.options.latency;
    // The target nearest to the onset gets it, if it has not had one already:
    // a second strum close to a hit target is an extra, not the next target.
    let nearest: Pending | null = null;
    for (const entry of this.pending) {
      const distance = Math.abs(entry.target.time - heard);
      if (
        distance <= TIMING_WINDOWS.hit &&
        (!nearest || distance < Math.abs(nearest.target.time - heard))
      ) {
        nearest = entry;
      }
    }
    if (!nearest || nearest.hit) return;
    const closest = Math.abs(nearest.target.time - heard);
    if (this.finished.slice(-RECENT).some((hit) => Math.abs(hit.target.time - heard) < closest)) {
      return;
    }
    const deviation = heard - nearest.target.time;
    nearest.hit = {
      target: nearest.target,
      timing: classifyTiming(deviation) ?? 'miss',
      deviation,
      correct: null,
      final: false,
    };
    nearest.check = new HitCheck(onset.time, nearest.target.expected, this.options.a4);
    this.options.onHit?.(nearest.hit);
  }

  addChroma(event: ChromaEvent): void {
    for (const entry of this.pending) {
      const result = entry.check?.chroma(event);
      if (result !== undefined && result !== null) this.settle(entry, result);
    }
    this.flush();
  }

  addPitch(frame: PitchFrame): void {
    for (const entry of this.pending) {
      const result = entry.check?.pitch(frame);
      if (result !== undefined && result !== null) this.settle(entry, result);
    }
    this.flush();
  }

  /** Calls misses and gives up on checks whose time has passed (`now` on the audio clock). */
  update(now: number): void {
    const missAfter = TIMING_WINDOWS.hit + this.options.latency + DETECTION_SECONDS;
    for (const entry of this.pending) {
      if (entry.hit?.final) continue;
      if (!entry.hit && now > entry.target.time + missAfter) {
        entry.hit = {
          target: entry.target,
          timing: 'miss',
          deviation: null,
          correct: false,
          final: true,
        };
        this.options.onHit?.(entry.hit);
      } else {
        const result = entry.check?.expire(now);
        if (result !== undefined && result !== null) this.settle(entry, result);
      }
    }
    this.flush();
  }

  /** Forgets targets from `time` on: playback was paused or restarted, they will not sound. */
  cancelFrom(time: number): void {
    this.pending = this.pending.filter((entry) => entry.target.time < time || entry.hit?.final);
  }

  /** Share of the credit earned in `pass` so far (judged targets only), or null if none yet. */
  passAccuracy(pass: number): number | null {
    const hits = [
      ...this.finished,
      ...this.pending.flatMap((entry) => (entry.hit?.final ? [entry.hit] : [])),
    ].filter((hit) => hit.target.pass === pass);
    if (hits.length === 0) return null;
    return hits.reduce((sum, hit) => sum + hitCredit(hit), 0) / hits.length;
  }

  /** Ends the session: unplayed targets are misses, unfinished checks count as wrong. */
  settleAll(): void {
    for (const entry of this.pending) {
      if (!entry.hit) {
        entry.hit = {
          target: entry.target,
          timing: 'miss',
          deviation: null,
          correct: false,
          final: true,
        };
        this.options.onHit?.(entry.hit);
      } else {
        this.settle(entry, false);
      }
    }
    this.flush();
  }

  reset(): void {
    this.pending = [];
    this.finished = [];
  }

  private settle(entry: Pending, correct: boolean): void {
    if (!entry.hit || entry.hit.final) return;
    entry.hit = { ...entry.hit, correct, final: true };
    entry.check = null;
    this.options.onHit?.(entry.hit);
  }

  /** Moves final hits out of the pending list, in target order. */
  private flush(): void {
    while (this.pending[0]?.hit?.final) {
      const entry = this.pending.shift();
      if (entry?.hit) this.finished.push(entry.hit);
    }
  }
}
