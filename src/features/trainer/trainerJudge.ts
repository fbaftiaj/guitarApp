import type { ChromaEvent } from '@/audio/dsp/chroma';
import type { Onset } from '@/audio/dsp/onsetDetector';
import type { PitchFrame } from '@/audio/dsp/pitchAnalyzer';
import { frequencyToMidi } from '@/lib/music/notes';
import { judgeStrum } from '../practice/scoring/chordRecognition';
import { HitCheck } from '../practice/scoring/hitCheck';

/** What the trainer is listening for: one string's note, or a whole chord. */
export type TrainerTarget = { kind: 'note'; midi: number } | { kind: 'chord'; chordId: string };

/** What was heard instead, when it was clear enough to say. */
export type Heard = { kind: 'note'; midi: number } | { kind: 'chord'; chordId: string };

export interface Judgement {
  correct: boolean;
  heard: Heard | null;
  /** Audio-clock time of the onset judged. */
  time: number;
}

/** After a judgement, the ringing string or chord is not judged again for this long. */
export const QUIET_SECONDS = 0.25;

/**
 * Judges each attempt (an onset) against the current target, with the same
 * checks the practicer uses: a single note by its steady pitch (±50 cents),
 * a chord by its chroma, strummed down or up. There is no timing: the
 * trainer waits for the player. An onset with no clear pitch is ignored
 * rather than counted wrong, so a knock or a breath does not mark a mistake.
 */
export class TrainerJudge {
  private readonly a4: number;
  private readonly onJudgement: (judgement: Judgement) => void;
  private target: TrainerTarget | null = null;
  private pending: { onsetTime: number; check: HitCheck | null } | null = null;
  private quietUntil = 0;

  constructor(a4: number, onJudgement: (judgement: Judgement) => void) {
    this.a4 = a4;
    this.onJudgement = onJudgement;
  }

  /** Starts listening for `target` (null: listen for nothing). */
  listenFor(target: TrainerTarget | null): void {
    this.target = target;
    this.pending = null;
  }

  onset(onset: Onset): void {
    const { target } = this;
    if (!target || onset.time < this.quietUntil) return;
    this.pending = {
      onsetTime: onset.time,
      check:
        target.kind === 'note'
          ? new HitCheck(onset.time, { kind: 'note', midi: target.midi }, this.a4)
          : null,
    };
  }

  chroma(event: ChromaEvent): void {
    const { target, pending } = this;
    if (target?.kind !== 'chord' || pending?.onsetTime !== event.onsetTime) return;
    const { correct, heardId } = judgeStrum(event.chroma, target.chordId);
    this.emit(correct, heardId === null ? null : { kind: 'chord', chordId: heardId });
  }

  pitch(frame: PitchFrame): void {
    const check = this.pending?.check;
    if (!check) return;
    const decided = check.pitch(frame) ?? check.expire(frame.time);
    if (decided === null) return;
    const frequency = check.heardFrequency;
    if (frequency === null) {
      // Nothing pitched followed the onset.
      this.pending = null;
      return;
    }
    this.emit(decided, { kind: 'note', midi: Math.round(frequencyToMidi(frequency, this.a4)) });
  }

  private emit(correct: boolean, heard: Heard | null): void {
    const time = this.pending?.onsetTime ?? 0;
    this.pending = null;
    this.quietUntil = time + QUIET_SECONDS;
    this.onJudgement({ correct, heard, time });
  }
}
