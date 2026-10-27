import { centsBetween, nearestNote, type SpelledNote } from '@/lib/music/notes';

/**
 * Tuner state machine: turns stable pitch readings into what the screen shows
 * (target note, cents, flat/sharp/in-tune cue) and into "string tuned"
 * events. Pure and clock-agnostic — times come from the audio clock — so it
 * is fully unit-testable.
 */

export type TunerMode = 'auto' | 'manual' | 'chromatic';
export type TuningCue = 'flat' | 'sharp' | 'in-tune';

export interface TunerTarget {
  /** Position of the string in the tuning (nut order). */
  index: number;
  note: SpelledNote;
  frequency: number;
}

export interface TunerReading {
  /** "listening" while there is no confident pitch. */
  status: 'listening' | 'pitch';
  frequency: number | null;
  /** Note being tuned to: the target string, or the nearest note in chromatic mode. */
  note: SpelledNote | null;
  /** String being tuned, null in chromatic mode. */
  targetIndex: number | null;
  /** Offset from the note in cents (not clamped). */
  cents: number | null;
  cue: TuningCue | null;
}

export type TunerEvent =
  | { type: 'tuned'; indices: readonly number[] }
  | { type: 'detuned'; indices: readonly number[] }
  | { type: 'all-tuned' };

/** Green zone: within ±5 cents counts as in tune. */
export const IN_TUNE_CENTS = 5;
/** Leaving the green zone takes a little more, so the cue does not flicker at its edge. */
const LEAVE_IN_TUNE_CENTS = 6;
/** A string must stay in the green zone this long to be ticked off. */
export const HOLD_TO_TUNE_SECONDS = 1;
/** A ticked string that drifts this far for this long loses its tick. */
const DETUNE_CENTS = 10;
const DETUNE_SECONDS = 0.5;
/** Dropouts shorter than this keep the last reading on screen. */
const SIGNAL_HOLD_SECONDS = 0.25;
/** Auto mode switches strings only when another one is clearly closer. */
export const AUTO_SWITCH_MARGIN_CENTS = 50;

export const LISTENING: TunerReading = {
  status: 'listening',
  frequency: null,
  note: null,
  targetIndex: null,
  cents: null,
  cue: null,
};

export function classifyCue(cents: number, previous: TuningCue | null): TuningCue {
  const limit = previous === 'in-tune' ? LEAVE_IN_TUNE_CENTS : IN_TUNE_CENTS;
  if (Math.abs(cents) <= limit) return 'in-tune';
  return cents < 0 ? 'flat' : 'sharp';
}

/**
 * Picks the string a frequency belongs to: the closest one by cents, with
 * hysteresis so a reading between two strings does not flip back and forth.
 */
export function chooseAutoTarget(
  frequency: number,
  targets: readonly TunerTarget[],
  current: number | null,
): number {
  let best = 0;
  let bestDistance = Infinity;
  for (const target of targets) {
    const distance = Math.abs(centsBetween(frequency, target.frequency));
    if (distance < bestDistance) {
      best = target.index;
      bestDistance = distance;
    }
  }
  const currentTarget = current === null ? undefined : targets[current];
  if (currentTarget && current !== best) {
    const currentDistance = Math.abs(centsBetween(frequency, currentTarget.frequency));
    if (currentDistance - bestDistance < AUTO_SWITCH_MARGIN_CENTS) return current ?? best;
  }
  return best;
}

export interface TunerEngineOptions {
  mode: TunerMode;
  targets: readonly TunerTarget[];
  a4: number;
  /** String to tune in manual mode. */
  selectedIndex: number;
}

export class TunerEngine {
  private options: TunerEngineOptions;
  private current: TunerReading = LISTENING;
  private readonly tunedIndices = new Set<number>();
  private lastPitchTime: number | null = null;
  private autoIndex: number | null = null;
  private inTuneSince: number | null = null;
  private detunedSince: number | null = null;
  private holdTicksUntil = -Infinity;

  constructor(options: TunerEngineOptions) {
    this.options = options;
  }

  get reading(): TunerReading {
    return this.current;
  }

  get tuned(): ReadonlySet<number> {
    return this.tunedIndices;
  }

  /**
   * Updates the configuration. New targets (another tuning, instrument or
   * reference pitch) clear the ticks, since they no longer apply.
   */
  configure(options: TunerEngineOptions): void {
    const targetsChanged =
      options.targets !== this.options.targets || options.a4 !== this.options.a4;
    const modeChanged =
      options.mode !== this.options.mode || options.selectedIndex !== this.options.selectedIndex;
    this.options = options;
    if (targetsChanged) this.tunedIndices.clear();
    if (targetsChanged || modeChanged) this.restartReading();
  }

  /**
   * Keeps showing readings but gives no ticks until `time` (audio clock):
   * while a reference note plays, the microphone hears it in tune.
   */
  holdTicks(until: number): void {
    this.holdTicksUntil = until;
    this.inTuneSince = null;
    this.detunedSince = null;
  }

  resetTuned(): void {
    this.tunedIndices.clear();
    this.restartReading();
  }

  /** Back to "listening", keeping the ticks (e.g. when the microphone stops). */
  clearReading(): void {
    this.restartReading();
  }

  /**
   * Feeds one reading: the stable frequency at `time`, or null when there is
   * no confident pitch. Returns the events it caused.
   */
  update(time: number, frequency: number | null): TunerEvent[] {
    if (frequency === null) {
      if (this.lastPitchTime === null || time - this.lastPitchTime > SIGNAL_HOLD_SECONDS) {
        this.current = LISTENING;
        this.inTuneSince = null;
        this.detunedSince = null;
      }
      return [];
    }
    this.lastPitchTime = time;

    const { mode, targets, a4, selectedIndex } = this.options;
    if (mode === 'chromatic') {
      const nearest = nearestNote(frequency, a4);
      const sameNote = this.current.note?.midi === nearest.note.midi;
      this.current = {
        status: 'pitch',
        frequency,
        note: nearest.note,
        targetIndex: null,
        cents: nearest.cents,
        cue: classifyCue(nearest.cents, sameNote ? this.current.cue : null),
      };
      return [];
    }

    const index =
      mode === 'auto' ? chooseAutoTarget(frequency, targets, this.autoIndex) : selectedIndex;
    const target = targets[index];
    if (!target) return [];
    if (mode === 'auto') this.autoIndex = index;
    if (index !== this.current.targetIndex) {
      // Another string: its hold-to-tune timer starts from scratch.
      this.inTuneSince = null;
      this.detunedSince = null;
    }

    const cents = centsBetween(frequency, target.frequency);
    const previousCue = this.current.targetIndex === index ? this.current.cue : null;
    const cue = classifyCue(cents, previousCue);
    this.current = {
      status: 'pitch',
      frequency,
      note: target.note,
      targetIndex: index,
      cents,
      cue,
    };
    return this.trackTuning(time, index, cents, cue);
  }

  private trackTuning(time: number, index: number, cents: number, cue: TuningCue): TunerEvent[] {
    if (time < this.holdTicksUntil) return [];
    // In auto mode, strings at the same pitch (12-string unison courses) cannot
    // be told apart, so they are ticked together.
    const group = this.options.mode === 'auto' ? this.samePitchAs(index) : [index];
    const events: TunerEvent[] = [];

    if (cue === 'in-tune') {
      this.detunedSince = null;
      this.inTuneSince ??= time;
      if (time - this.inTuneSince >= HOLD_TO_TUNE_SECONDS && !this.tunedIndices.has(index)) {
        group.forEach((i) => this.tunedIndices.add(i));
        events.push({ type: 'tuned', indices: group });
        if (this.tunedIndices.size === this.options.targets.length)
          events.push({ type: 'all-tuned' });
      }
      return events;
    }

    this.inTuneSince = null;
    if (this.tunedIndices.has(index) && Math.abs(cents) > DETUNE_CENTS) {
      this.detunedSince ??= time;
      if (time - this.detunedSince >= DETUNE_SECONDS) {
        group.forEach((i) => this.tunedIndices.delete(i));
        this.detunedSince = null;
        events.push({ type: 'detuned', indices: group });
      }
    } else {
      this.detunedSince = null;
    }
    return events;
  }

  private samePitchAs(index: number): number[] {
    const midi = this.options.targets[index]?.note.midi;
    return this.options.targets.filter((t) => t.note.midi === midi).map((t) => t.index);
  }

  private restartReading(): void {
    this.current = LISTENING;
    this.lastPitchTime = null;
    this.autoIndex = null;
    this.inTuneSince = null;
    this.detunedSince = null;
  }
}
