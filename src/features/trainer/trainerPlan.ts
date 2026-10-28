import { CHORDS } from '@/content/chords';

/**
 * The chord trainer's steps, in order. Learning a chord goes string by
 * string (each sounding string from the lowest up, checked by pitch), then
 * strums of the whole chord. Changes then alternate between the chords, each
 * one waiting until it is played right.
 */
export type TrainerStep =
  | { kind: 'string'; chordId: string; string: number; midi: number }
  | { kind: 'strum'; chordId: string; needed: number }
  | { kind: 'change'; chordId: string };

export const STRUMS_PER_CHORD = 3;
export const DEFAULT_CHANGES = 8;

export interface TrainerOptions {
  /** Library chord ids, in the order to practise them. */
  chords: readonly string[];
  /** Learn each chord string by string and with strums first. */
  learn: boolean;
  /** Chords to play in the changes part (needs two or more chords). */
  changes?: number;
}

export function trainerPlan({
  chords,
  learn,
  changes = DEFAULT_CHANGES,
}: TrainerOptions): TrainerStep[] {
  const known = chords.filter((id) => CHORDS.has(id));
  const steps: TrainerStep[] = [];
  if (learn) {
    for (const chordId of known) {
      const chord = CHORDS.get(chordId);
      if (!chord) continue;
      chord.midis.forEach((midi, i) => {
        if (midi !== null) steps.push({ kind: 'string', chordId, string: 6 - i, midi });
      });
      steps.push({ kind: 'strum', chordId, needed: STRUMS_PER_CHORD });
    }
  }
  if (known.length >= 2) {
    for (let i = 0; i < changes; i++) {
      steps.push({ kind: 'change', chordId: known[i % known.length] ?? '' });
    }
  }
  return steps;
}

/** During changes, the chord to play after step `index`, if there is one. */
export function nextChordAfter(plan: readonly TrainerStep[], index: number): string | null {
  const next = plan[index + 1];
  return plan[index]?.kind === 'change' && next?.kind === 'change' ? next.chordId : null;
}

export interface TrainerSection {
  key: string;
  label: string;
  start: number;
  end: number;
}

/** Steps grouped into sections: learning each chord, then the changes. */
export function sectionsOf(plan: readonly TrainerStep[]): TrainerSection[] {
  const sections: TrainerSection[] = [];
  plan.forEach((step, i) => {
    const key = step.kind === 'change' ? 'changes' : `learn-${step.chordId}`;
    const last = sections.at(-1);
    if (last?.key === key) last.end = i + 1;
    else {
      sections.push({
        key,
        label: step.kind === 'change' ? 'Changes' : step.chordId,
        start: i,
        end: i + 1,
      });
    }
  });
  return sections;
}
