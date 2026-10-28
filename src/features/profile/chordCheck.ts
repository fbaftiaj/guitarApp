import { checkChord, recognizeChord } from '../practice/scoring/chordRecognition';

export interface StrumJudgement {
  correct: boolean;
  /** The chord it sounded most like, if anything was clear enough. */
  heardId: string | null;
}

/** Judges one strum's chroma against `chordId`, played down or up. */
export function judgeStrum(chroma: readonly number[], chordId: string): StrumJudgement {
  if (checkChord(chroma, chordId, 'down').correct || checkChord(chroma, chordId, 'up').correct) {
    return { correct: true, heardId: chordId };
  }
  return { correct: false, heardId: recognizeChord(chroma)?.id ?? null };
}
