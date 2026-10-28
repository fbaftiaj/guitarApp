import { MAX_TEMPO, MIN_TEMPO } from '@/content/exercises';
import type { MusicalEvent } from './arrangement';

/**
 * The practicer's transport: a pure state machine on the audio clock (seconds)
 * that maps time to a position in beats, and turns the exercise into sounds
 * with exact audio-clock start times. It never touches Web Audio; a lookahead
 * scheduler calls `advance()` every ~25 ms for the next ~100 ms.
 *
 * Playback is a list of runs. A run is continuous, piecewise-linear motion
 * through "virtual beats": a count-in runs from a whole beat before the start
 * position up to it while the position holds still, so its clicks stay on
 * the beat grid. Pausing, waiting, finishing and loop wraps end a run; the
 * next run starts where it left off (or at the loop start).
 */

export type TransportPhase = 'idle' | 'countIn' | 'playing' | 'waiting' | 'paused' | 'finished';

export interface BeatRange {
  start: number;
  end: number;
}

export interface SpeedUp {
  /** BPM added after each successful pass. */
  step: number;
  /** Tempo at which speeding up stops. */
  target: number;
}

export interface TransportSettings {
  tempo: number;
  /** Beats to repeat; null plays the exercise once (or loops it all with speed-up). */
  loop: BeatRange | null;
  /** Stop at each target (chord or note) until `advanceWait()`. */
  waitMode: boolean;
  speedUp: SpeedUp | null;
}

export interface PassInfo {
  /** 1-based number of the pass that just ended. */
  pass: number;
  /** Audio-clock time at which it ends. */
  endTime: number;
}

export interface TransportConfig {
  beatsPerBar: number;
  totalBeats: number;
  /** Musical events sorted by beat. */
  events: readonly MusicalEvent[];
  /** Beats wait mode stops at, sorted. */
  targets: readonly number[];
  /** Count-in length in beats (one bar by default). */
  countInBeats?: number;
  /** Delay between a start command and the first sound, so it can be scheduled in time. */
  startDelay?: number;
  /** Decides whether a pass earns a speed-up; listening and scoring plug in here. */
  judgePass?: (pass: PassInfo) => boolean;
}

export type ScheduledSound =
  | { kind: 'click'; time: number; beat: number; accent: boolean; countIn: boolean }
  | {
      kind: 'music';
      time: number;
      /** Seconds. */
      duration: number;
      event: MusicalEvent;
      /** Loop pass the sound belongs to. */
      pass: number;
    };

export type TransportNotice =
  | { kind: 'pass'; time: number; pass: number; tempo: number; previousTempo: number }
  | { kind: 'waiting'; time: number; beat: number }
  | { kind: 'finished'; time: number };

export interface TransportSnapshot {
  phase: TransportPhase;
  /** Position in beats from the start of the exercise. */
  beat: number;
  tempo: number;
  /** Click number during a count-in (1 … count-in length), else null. */
  countIn: number | null;
  /** Current pass through the loop, from 1. */
  pass: number;
}

/** Logical state as of the latest command or scheduled event. */
export type TransportStatus = 'idle' | 'running' | 'waiting' | 'paused' | 'finished';

interface TempoPoint {
  time: number;
  /** Virtual beat at `time`. */
  beat: number;
  tempo: number;
}

type EndReason = 'paused' | 'waiting' | 'finished' | 'wrapped' | 'stopped';

interface Run {
  /** Where the music starts; virtual beats before it are count-in. */
  from: number;
  /** Events exactly at `from` were already played (moving on in wait mode). */
  skipFrom: boolean;
  /** Virtual beat of the first count-in click (equals `from` without a count-in). */
  countInFrom: number;
  /** Tempo changes in time order; the first is the run's start. */
  points: [TempoPoint, ...TempoPoint[]];
  /** Virtual beat up to which sounds have been produced. */
  cursor: number;
  pass: number;
  end: { time: number; beat: number; reason: EndReason } | null;
  /** State before the loop wrap that started this run, to undo a cancelled wrap. */
  undo: { tempo: number; pass: number } | null;
}

const EPSILON = 1e-9;
const DEFAULT_START_DELAY = 0.05;
/** Ended runs are kept this long so snapshots slightly in the past still resolve. */
const HISTORY_SECONDS = 2;

export function clampTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return MIN_TEMPO;
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));
}

function secondsPerBeat(tempo: number): number {
  return 60 / tempo;
}

function lastPoint(run: Run, time: number): TempoPoint {
  let found = run.points[0];
  for (const point of run.points) {
    if (point.time <= time) found = point;
    else break;
  }
  return found;
}

function beatAt(run: Run, time: number): number {
  const point = lastPoint(run, time);
  return point.beat + Math.max(0, time - point.time) / secondsPerBeat(point.tempo);
}

function timeAt(run: Run, beat: number): number {
  let found = run.points[0];
  for (const point of run.points) {
    if (point.beat <= beat + EPSILON) found = point;
    else break;
  }
  return found.time + (beat - found.beat) * secondsPerBeat(found.tempo);
}

function runStart(run: Run): number {
  return run.points[0].time;
}

/** First index whose beat is at or after `beat`, for `count` items sorted by beat. */
function lowerBound(count: number, beatOf: (index: number) => number, beat: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (beatOf(middle) < beat - EPSILON) low = middle + 1;
    else high = middle;
  }
  return low;
}

export class Transport {
  private readonly config: Required<Omit<TransportConfig, 'judgePass'>> &
    Pick<TransportConfig, 'judgePass'>;
  private settingsValue: TransportSettings;
  private runs: Run[] = [];
  private idleBeat = 0;
  private pass = 1;
  private scheduledUntil = -Infinity;
  private passJudge: ((pass: PassInfo) => boolean) | undefined;

  constructor(config: TransportConfig, settings: TransportSettings) {
    this.config = {
      countInBeats: config.beatsPerBar,
      startDelay: DEFAULT_START_DELAY,
      ...config,
    };
    this.checkLoop(settings.loop);
    this.settingsValue = { ...settings, tempo: clampTempo(settings.tempo) };
    this.passJudge = config.judgePass;
    this.idleBeat = this.range().start;
  }

  get settings(): Readonly<TransportSettings> {
    return this.settingsValue;
  }

  get status(): TransportStatus {
    const run = this.runs.at(-1);
    if (!run) return 'idle';
    switch (run.end?.reason) {
      case undefined:
      case 'wrapped':
        return 'running';
      case 'waiting':
        return 'waiting';
      case 'paused':
        return 'paused';
      case 'finished':
        return 'finished';
      case 'stopped':
        return 'idle';
    }
  }

  /** Beats that play: the loop, the whole exercise when speeding up, or start to end. */
  range(): BeatRange & { loops: boolean } {
    const { loop, speedUp } = this.settingsValue;
    if (loop) return { ...loop, loops: true };
    return { start: 0, end: this.config.totalBeats, loops: speedUp !== null };
  }

  snapshotAt(time: number): TransportSnapshot {
    let index = -1;
    this.runs.forEach((candidate, i) => {
      if (runStart(candidate) <= time) index = i;
    });
    const run = this.runs[index];
    const upcoming = this.runs[index + 1];
    // Before a run that has been started but not reached yet (the start delay):
    // report it as starting, so the screen does not flash the previous state.
    if (upcoming && (!run || (run.end && time >= run.end.time))) {
      return {
        phase: upcoming.countInFrom < upcoming.from ? 'countIn' : 'playing',
        beat: upcoming.from,
        tempo: upcoming.points[0].tempo,
        countIn: null,
        pass: upcoming.pass,
      };
    }
    if (!run) {
      const tempo = this.settingsValue.tempo;
      return { phase: 'idle', beat: this.idleBeat, tempo, countIn: null, pass: this.pass };
    }
    const runTempo = lastPoint(run, time).tempo;
    if (run.end && time >= run.end.time) {
      const phases: Record<EndReason, TransportPhase> = {
        paused: 'paused',
        waiting: 'waiting',
        finished: 'finished',
        wrapped: 'playing',
        stopped: 'idle',
      };
      return {
        phase: phases[run.end.reason],
        beat: run.end.beat,
        tempo: runTempo,
        countIn: null,
        pass: run.pass,
      };
    }
    const beat = beatAt(run, time);
    if (beat < run.from - EPSILON) {
      const countIn = Math.floor(beat - run.countInFrom + EPSILON) + 1;
      return { phase: 'countIn', beat: run.from, tempo: runTempo, countIn, pass: run.pass };
    }
    return { phase: 'playing', beat, tempo: runTempo, countIn: null, pass: run.pass };
  }

  /** Replaces the pass judge (see `TransportConfig.judgePass`). */
  setPassJudge(judge: ((pass: PassInfo) => boolean) | undefined): void {
    this.passJudge = judge;
  }

  /** Starts, or resumes after a pause (with a count-in unless in wait mode). */
  play(now: number): void {
    const status = this.status;
    if (status === 'running' || status === 'waiting') return;
    const range = this.range();
    let from = range.start;
    if (status === 'paused') {
      const beat = this.runs.at(-1)?.end?.beat ?? range.start;
      if (beat >= range.start - EPSILON && beat < range.end - EPSILON) from = beat;
    } else if (status === 'idle') {
      from = this.idleBeat;
    }
    if (status === 'finished' || from === range.start) this.pass = 1;
    this.startRun(now + this.config.startDelay, from, {
      countIn: !this.settingsValue.waitMode,
      skipFrom: false,
      pass: this.pass,
    });
  }

  /** Freezes the position at `now`. Sounds scheduled after `now` must be silenced. */
  pause(now: number): void {
    this.dropAfter(now);
    const run = this.runs.at(-1);
    if (!run) return;
    if (run.end) {
      if (run.end.reason === 'waiting') run.end.reason = 'paused';
      return;
    }
    this.endRun(run, now, this.snapshotAt(now).beat, 'paused');
  }

  /** Back to the start (of the loop). Keeps playing if it was playing. */
  restart(now: number): void {
    const wasActive = this.status === 'running' || this.status === 'waiting';
    this.dropAfter(now);
    const run = this.runs.at(-1);
    const start = this.range().start;
    this.pass = 1;
    if (run && !run.end) this.endRun(run, now, start, 'stopped');
    if (wasActive) {
      this.startRun(now + this.config.startDelay, start, {
        countIn: !this.settingsValue.waitMode,
        skipFrom: false,
        pass: 1,
      });
    } else {
      this.runs = [];
      this.idleBeat = start;
      this.scheduledUntil = -Infinity;
    }
  }

  /**
   * In wait mode: the awaited chord or note was played, carry on from it. A
   * stop scheduled but not reached yet is skipped seamlessly.
   */
  advanceWait(now: number): void {
    const run = this.runs.at(-1);
    if (run?.end?.reason !== 'waiting') return;
    this.startRun(Math.max(run.end.time, now + this.config.startDelay), run.end.beat, {
      countIn: false,
      skipFrom: true,
      pass: run.pass,
    });
  }

  setTempo(bpm: number, now: number): void {
    const tempo = clampTempo(bpm);
    if (tempo === this.settingsValue.tempo) return;
    this.settingsValue = { ...this.settingsValue, tempo };
    const run = this.runs.at(-1);
    if (!run || run.end) return;
    // Sounds up to the horizon are already scheduled: change from there on.
    const time = Math.max(now, this.scheduledUntil, runStart(run));
    const beat = beatAt(run, time);
    const last = run.points.at(-1);
    if (last && Math.abs(last.time - time) < EPSILON) {
      last.tempo = tempo;
    } else {
      run.points.push({ time, beat, tempo });
    }
  }

  setLoop(loop: BeatRange | null, now: number): void {
    this.checkLoop(loop);
    this.settingsValue = { ...this.settingsValue, loop };
    this.keepInRange(now);
  }

  setSpeedUp(speedUp: SpeedUp | null, now: number): void {
    this.settingsValue = { ...this.settingsValue, speedUp };
    this.keepInRange(now);
  }

  setWaitMode(waitMode: boolean, now: number): void {
    if (waitMode === this.settingsValue.waitMode) return;
    this.settingsValue = { ...this.settingsValue, waitMode };
    const run = this.runs.at(-1);
    if (!waitMode && run?.end?.reason === 'waiting') {
      // Carry on without skipping the chord that was awaited.
      this.startRun(Math.max(run.end.time, now + this.config.startDelay), run.end.beat, {
        countIn: false,
        skipFrom: false,
        pass: run.pass,
      });
    }
  }

  /** Produces every sound due before `until` and the notices for what happens on the way. */
  advance(until: number): { sounds: ScheduledSound[]; notices: TransportNotice[] } {
    const sounds: ScheduledSound[] = [];
    const notices: TransportNotice[] = [];
    // A loop shorter than the lookahead can wrap several times in one call.
    for (let guard = 0; guard < 64; guard++) {
      const run = this.runs.at(-1);
      if (!run || run.end || runStart(run) >= until) break;
      const reach = beatAt(run, until);
      const stop = this.nextStop(run);
      if (stop.beat > reach + EPSILON) {
        this.emit(run, reach, sounds);
        break;
      }
      this.emit(run, stop.beat, sounds);
      const time = timeAt(run, stop.beat);
      if (stop.kind === 'wait') {
        this.endRun(run, time, stop.beat, 'waiting');
        notices.push({ kind: 'waiting', time, beat: stop.beat });
        break;
      }
      const range = this.range();
      if (!range.loops) {
        this.endRun(run, time, stop.beat, 'finished');
        notices.push({ kind: 'finished', time });
        break;
      }
      this.wrap(run, time, range.start, notices);
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, until);
    this.prune(until);
    return { sounds, notices };
  }

  private checkLoop(loop: BeatRange | null): void {
    if (loop && !(loop.start >= 0 && loop.end > loop.start && loop.end <= this.config.totalBeats)) {
      throw new RangeError(`Invalid loop ${loop.start}–${loop.end}`);
    }
  }

  private wrap(run: Run, time: number, start: number, notices: TransportNotice[]): void {
    const previousTempo = this.settingsValue.tempo;
    const previousPass = this.pass;
    const { speedUp } = this.settingsValue;
    const judge = this.passJudge ?? (() => true);
    if (speedUp && previousTempo < speedUp.target && judge({ pass: previousPass, endTime: time })) {
      this.settingsValue = {
        ...this.settingsValue,
        tempo: clampTempo(Math.min(speedUp.target, previousTempo + speedUp.step)),
      };
    }
    this.pass = previousPass + 1;
    this.endRun(run, time, run.cursor, 'wrapped');
    this.startRun(time, start, { countIn: false, skipFrom: false, pass: this.pass });
    const next = this.runs.at(-1);
    if (next) next.undo = { tempo: previousTempo, pass: previousPass };
    notices.push({
      kind: 'pass',
      time,
      pass: previousPass,
      tempo: this.settingsValue.tempo,
      previousTempo,
    });
  }

  private nextStop(run: Run): { beat: number; kind: 'wait' | 'end' } {
    const end = this.range().end;
    if (this.settingsValue.waitMode) {
      const { targets } = this.config;
      const from = Math.max(run.cursor, run.from);
      const targetAt = (i: number) => targets[i] ?? Infinity;
      for (let i = lowerBound(targets.length, targetAt, from); i < targets.length; i++) {
        const target = targetAt(i);
        if (target >= end - EPSILON) break;
        if (run.skipFrom && Math.abs(target - run.from) < EPSILON) continue;
        return { beat: target, kind: 'wait' };
      }
    }
    return { beat: end, kind: 'end' };
  }

  /** Adds the sounds between the run's cursor and `to` (virtual beats). */
  private emit(run: Run, to: number, sounds: ScheduledSound[]): void {
    const from = run.cursor;
    if (to <= from + EPSILON) return;
    const { beatsPerBar, events } = this.config;
    const skip = (beat: number) => run.skipFrom && Math.abs(beat - run.from) < EPSILON;

    const clicks: ScheduledSound[] = [];
    // `|| 0` turns −0 (the ceiling of a tiny negative) into 0.
    for (let beat = Math.ceil(from - EPSILON) || 0; beat < to - EPSILON; beat++) {
      const countIn = beat < run.from - EPSILON;
      if (!countIn && skip(beat)) continue;
      clicks.push({
        kind: 'click',
        time: timeAt(run, beat),
        beat,
        accent: countIn ? beat === run.countInFrom : beat % beatsPerBar === 0,
        countIn,
      });
    }

    const music: ScheduledSound[] = [];
    const eventAt = (i: number) => events[i]?.beat ?? Infinity;
    for (
      let i = lowerBound(events.length, eventAt, Math.max(from, run.from));
      i < events.length;
      i++
    ) {
      const event = events[i];
      if (!event || event.beat >= to - EPSILON) break;
      if (skip(event.beat)) continue;
      const time = timeAt(run, event.beat);
      const duration =
        'duration' in event ? event.duration * secondsPerBeat(lastPoint(run, time).tempo) : 0;
      music.push({ kind: 'music', time, duration, event, pass: run.pass });
    }

    // Clicks first at equal times, so the metronome is never late against the music.
    sounds.push(...[...clicks, ...music].sort((a, b) => a.time - b.time));
    run.cursor = to;
  }

  private startRun(
    time: number,
    from: number,
    options: { countIn: boolean; skipFrom: boolean; pass: number },
  ): void {
    const countInFrom = options.countIn
      ? Math.ceil(from - EPSILON) - this.config.countInBeats
      : from;
    this.runs.push({
      from,
      skipFrom: options.skipFrom,
      countInFrom,
      points: [{ time, beat: countInFrom, tempo: this.settingsValue.tempo }],
      cursor: countInFrom,
      pass: options.pass,
      end: null,
      undo: null,
    });
    this.pass = options.pass;
  }

  private endRun(run: Run, time: number, beat: number, reason: EndReason): void {
    run.end = { time, beat, reason };
    const [first, ...rest] = run.points;
    run.points = [first, ...rest.filter((point) => point.time <= time)];
  }

  /** Cancels what was scheduled past `now`: later runs (undoing their loop wrap) and ends. */
  private dropAfter(now: number): void {
    for (let run = this.runs.at(-1); run && runStart(run) > now; run = this.runs.at(-1)) {
      this.runs.pop();
      if (run.undo) {
        if (this.settingsValue.tempo === run.points[0].tempo) {
          this.settingsValue = { ...this.settingsValue, tempo: run.undo.tempo };
        }
        this.pass = run.undo.pass;
      }
    }
    const run = this.runs.at(-1);
    if (run?.end && run.end.time > now) {
      run.end = null;
      this.pass = run.pass;
    }
    this.scheduledUntil = Math.min(this.scheduledUntil, now);
  }

  /** After a loop change: a running position outside the new range jumps to its start. */
  private keepInRange(now: number): void {
    const range = this.range();
    const run = this.runs.at(-1);
    const status = this.status;
    if (status === 'idle') {
      if (this.idleBeat < range.start || this.idleBeat >= range.end) this.idleBeat = range.start;
      return;
    }
    if (!run) return;
    if (status === 'paused' || status === 'waiting') {
      const end = run.end;
      if (end && (end.beat < range.start - EPSILON || end.beat >= range.end - EPSILON)) {
        end.beat = range.start;
        end.reason = 'paused';
      }
      return;
    }
    if (status !== 'running' || run.end) return;
    const time = Math.max(now, this.scheduledUntil, runStart(run));
    const beat = Math.max(beatAt(run, time), run.from);
    if (beat >= range.start - EPSILON && beat < range.end - EPSILON) return;
    const inCountIn = beatAt(run, time) < run.from - EPSILON;
    this.endRun(run, time, beat, 'wrapped');
    this.startRun(time, range.start, {
      countIn: inCountIn && !this.settingsValue.waitMode,
      skipFrom: false,
      pass: run.pass,
    });
  }

  private prune(now: number): void {
    for (
      let next = this.runs[1];
      next && runStart(next) <= now - HISTORY_SECONDS;
      next = this.runs[1]
    ) {
      this.runs.shift();
    }
  }
}
