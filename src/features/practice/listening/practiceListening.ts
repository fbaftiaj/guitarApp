import type { Listener } from '@/audio/listener';
import { DEFAULT_INSTRUMENT_ID, findInstrument } from '@/content/instruments';
import { noteLabel, spellMidi } from '@/lib/music/notes';
import { indexAtBeat, type Timeline } from '../engine/timeline';
import type { PassInfo, ScheduledSound, TransportNotice } from '../engine/transport';
import type { Expected } from '../scoring/hitCheck';
import { scoringLatency } from '../scoring/latency';
import { Scorer, hitCredit, type Hit, type ScoringTarget } from '../scoring/scorer';
import { WaitMatcher } from '../scoring/waitMatcher';
import type { SessionInput } from '../sessionInput';
import type { ListeningError } from './microphoneErrors';
import { CLOSE_DELAY_MS, openInput } from './openInput';

/** A loop pass this accurate earns an auto speed-up. */
export const SPEED_UP_ACCURACY = 0.8;

/** How a target looks on the highway once judged. */
export type HitMark = 'good' | 'off' | 'wrong' | 'miss';

export interface ListeningFeedback {
  /** The latest hit (reported when timed, and again when final). */
  hit: Hit;
  /** Judged targets of the current loop pass, by timeline index. */
  marks: ReadonlyMap<number, HitMark>;
  /** Running accuracy (0–1) of the session's judged targets. */
  accuracy: number | null;
}

function markOf(hit: Hit): HitMark | null {
  if (!hit.final) return null;
  if (hit.timing === 'miss') return 'miss';
  if (!hit.correct) return 'wrong';
  return hit.timing === 'perfect' || hit.timing === 'good' ? 'good' : 'off';
}

export interface ListeningCallbacks {
  onFeedback: (feedback: ListeningFeedback) => void;
  /** Wait mode: an attempt at the awaited chord or note was judged. */
  onWaitAttempt: (correct: boolean) => void;
  /** Wait mode: the awaited chord or note was played; carry on. */
  onWaitSatisfied: () => void;
  /** Wait mode: a new chord or note is awaited. */
  onWaitStarted?: () => void;
  onError: (error: ListeningError) => void;
}

export interface WaitStats {
  /** Chords or notes waited for. */
  targets: number;
  /** Of those, played right on the first try. */
  firstTry: number;
}

const guitar = findInstrument(DEFAULT_INSTRUMENT_ID);
/** Where guitar notes are listened for. */
export const GUITAR_PITCH_RANGE = {
  minFrequency: guitar?.detection.minHz ?? 50,
  maxFrequency: guitar?.detection.maxHz ?? 1400,
};

/**
 * Listening for the practicer: turns the guide part's scheduled strums and
 * notes into scoring targets, feeds what the microphone hears to the scorer
 * (or, in wait mode, to the wait matcher), and keeps the session's timing.
 */
export class PracticeListening implements SessionInput {
  readonly scorer: Scorer;
  private readonly timeline: Timeline;
  private readonly a4: number;
  private readonly latencyMs: number | null;
  private readonly callbacks: ListeningCallbacks;
  private readonly waitMatcher: WaitMatcher;
  private listener: Listener | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private nextTargetId = 0;
  private waitMode = false;
  private waitKey: string | null = null;
  private waitAttempts = 0;
  private stats: WaitStats = { targets: 0, firstTry: 0 };
  /** Audio-clock time of the first target, for the timing chart. */
  private firstTargetTime: number | null = null;
  private startedAt: number | null = null;
  private playingSince: number | null = null;
  private playedMs = 0;
  private marks = new Map<number, HitMark>();
  private markPass = 0;
  private credit = 0;
  private judged = 0;

  constructor(options: {
    timeline: Timeline;
    a4: number;
    latencyMs: number | null;
    waitMode: boolean;
    callbacks: ListeningCallbacks;
  }) {
    this.timeline = options.timeline;
    this.a4 = options.a4;
    this.latencyMs = options.latencyMs;
    this.waitMode = options.waitMode;
    this.callbacks = options.callbacks;
    this.scorer = new Scorer({
      latency: 0,
      a4: this.a4,
      onHit: (hit) => {
        this.report(hit);
      },
    });
    this.waitMatcher = new WaitMatcher({
      a4: this.a4,
      onAttempt: (correct) => {
        this.waitAttempts++;
        if (correct && this.waitAttempts === 1) this.stats.firstTry++;
        this.callbacks.onWaitAttempt(correct);
        if (correct) {
          this.waitKey = null;
          this.callbacks.onWaitSatisfied();
        }
      },
    });
  }

  get waitStats(): Readonly<WaitStats> {
    return this.stats;
  }

  /** The session so far: when it started (epoch ms), how long it played, the chart origin. */
  get session(): { startedAt: number | null; durationMs: number; startTime: number } {
    const running = this.playingSince === null ? 0 : performance.now() - this.playingSince;
    return {
      startedAt: this.startedAt,
      durationMs: this.playedMs + running,
      startTime: this.firstTargetTime ?? 0,
    };
  }

  setWaitMode(waitMode: boolean): void {
    this.waitMode = waitMode;
    if (!waitMode) this.waitMatcher.clear();
  }

  async start(context: AudioContext): Promise<void> {
    this.clearCloseTimer();
    this.scorer.setLatency(scoringLatency(this.latencyMs, context));
    this.listener ??= await openInput(
      context,
      {
        features: {
          pitch: this.timeline.kind === 'notes' ? GUITAR_PITCH_RANGE : null,
          onsets: true,
          chroma: this.timeline.kind === 'chords',
          a4: this.a4,
        },
        onOnset: (onset) => {
          this.scorer.addOnset(onset);
          this.waitMatcher.addOnset(onset);
        },
        onChroma: (event) => {
          this.scorer.addChroma(event);
          this.waitMatcher.addChroma(event);
        },
        onPitch: (frame) => {
          this.scorer.addPitch(frame);
          this.waitMatcher.addPitch(frame);
        },
        onEnded: () => {
          this.callbacks.onError('disconnected');
        },
      },
      this.callbacks.onError,
    );
    this.startedAt ??= Date.now();
    this.playingSince = performance.now();
  }

  scheduled(sounds: readonly ScheduledSound[], notices: readonly TransportNotice[]): void {
    if (!this.waitMode) {
      for (const sound of sounds) {
        if (sound.kind !== 'music' || sound.event.part !== 'guide') continue;
        const target = this.targetFor(sound.event.beat, sound.time, sound.pass);
        if (target) {
          this.firstTargetTime ??= target.time;
          this.scorer.addTarget(target);
        }
      }
    }
    for (const notice of notices) {
      if (notice.kind !== 'waiting') continue;
      const expected = this.expectedAt(notice.beat);
      if (!expected) continue;
      // Waiting again at the same target (after a pause) is not a new one.
      const key = `${notice.beat}`;
      if (key !== this.waitKey) {
        this.waitKey = key;
        this.waitAttempts = 0;
        this.stats.targets++;
        this.callbacks.onWaitStarted?.();
      }
      this.waitMatcher.wait(expected, notice.time);
    }
  }

  cancel(time: number, reason: 'pause' | 'restart'): void {
    this.scorer.cancelFrom(time);
    this.waitMatcher.clear();
    if (reason === 'restart') this.reset();
  }

  waitEnded(): void {
    this.waitMatcher.clear();
    this.waitKey = null;
  }

  update(now: number): void {
    this.scorer.update(now);
    this.waitMatcher.update(now);
  }

  judgePass(info: PassInfo): boolean {
    const accuracy = this.scorer.passAccuracy(info.pass);
    return accuracy !== null && accuracy >= SPEED_UP_ACCURACY;
  }

  stop(): void {
    if (this.playingSince !== null) this.playedMs += performance.now() - this.playingSince;
    this.playingSince = null;
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.listener?.close();
      this.listener = null;
    }, CLOSE_DELAY_MS);
  }

  /** Ends scoring: everything still open is judged now. */
  settle(): readonly Hit[] {
    this.scorer.settleAll();
    return this.scorer.hits;
  }

  /** Starts a new session (after a restart, or once results were shown). */
  reset(): void {
    this.marks = new Map();
    this.markPass = 0;
    this.credit = 0;
    this.judged = 0;
    this.scorer.reset();
    this.waitMatcher.clear();
    this.waitKey = null;
    this.waitAttempts = 0;
    this.stats = { targets: 0, firstTry: 0 };
    this.firstTargetTime = null;
    this.startedAt = null;
    this.playedMs = 0;
    this.playingSince = this.playingSince === null ? null : performance.now();
  }

  /** Releases the microphone now (leaving the screen, or listening turned off). */
  dispose(): void {
    this.clearCloseTimer();
    this.listener?.close();
    this.listener = null;
  }

  private report(hit: Hit): void {
    const mark = markOf(hit);
    if (mark) {
      if (hit.target.pass !== this.markPass) this.marks = new Map();
      this.markPass = hit.target.pass;
      this.marks = new Map(this.marks).set(hit.target.index, mark);
      this.credit += hitCredit(hit);
      this.judged++;
    }
    this.callbacks.onFeedback({
      hit,
      marks: this.marks,
      accuracy: this.judged > 0 ? this.credit / this.judged : null,
    });
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private targetFor(beat: number, time: number, pass: number): ScoringTarget | null {
    const { timeline } = this;
    if (timeline.kind === 'chords') {
      const index = indexAtBeat(timeline.strums, beat);
      const strum = timeline.strums[index];
      if (!strum || Math.abs(strum.beat - beat) > 1e-6) return null;
      const segment = timeline.chords[indexAtBeat(timeline.chords, beat)];
      return {
        id: ++this.nextTargetId,
        index,
        pass,
        time,
        expected: { kind: 'chord', chordId: strum.chordId, direction: strum.direction },
        label: strum.chordId,
        change: segment !== undefined && Math.abs(segment.beat - beat) < 1e-6,
      };
    }
    const index = indexAtBeat(timeline.notes, beat);
    const note = timeline.notes[index];
    if (!note || Math.abs(note.beat - beat) > 1e-6) return null;
    return {
      id: ++this.nextTargetId,
      index,
      pass,
      time,
      expected: { kind: 'note', midi: note.midi },
      label: noteLabel(spellMidi(note.midi)),
      change: false,
    };
  }

  private expectedAt(beat: number): Expected | null {
    const { timeline } = this;
    if (timeline.kind === 'chords') {
      const segment = timeline.chords[indexAtBeat(timeline.chords, beat)];
      return segment ? { kind: 'chord', chordId: segment.chordId, direction: 'down' } : null;
    }
    const note = timeline.notes[indexAtBeat(timeline.notes, beat)];
    return note ? { kind: 'note', midi: note.midi } : null;
  }
}
