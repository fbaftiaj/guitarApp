import { CHORDS } from '@/content/chords';
import { noteName, spellMidi } from '@/lib/music/notes';
import type { TrainerStep } from './trainerPlan';
import type { TrainerFeedback } from './trainerState';

const STRING_NAMES = ['', 'high e', 'B', 'G', 'D', 'A', 'low E'];

const chordName = (id: string) => CHORDS.get(id)?.name ?? id;

/** "string 4 (D)" */
export function stringLabel(string: number): string {
  return `string ${string} (${STRING_NAMES[string] ?? ''})`;
}

/** What to do now, as a heading and a detail line. */
export function instruction(step: TrainerStep): { title: string; detail: string } {
  if (step.kind === 'string') {
    const chord = CHORDS.get(step.chordId);
    const i = 6 - step.string;
    const fret = chord?.frets[i] ?? 0;
    const finger = chord?.fingers[i];
    return {
      title: `Play ${stringLabel(step.string)}`,
      detail:
        fret === 0
          ? 'Open: let it ring without touching it.'
          : `Finger ${finger ?? ''} on fret ${fret}. Pick just this string.`,
    };
  }
  if (step.kind === 'strum') {
    return {
      title: `Now strum ${chordName(step.chordId)}`,
      detail: `Strum all the strings it uses, ${step.needed} times.`,
    };
  }
  return { title: `Play ${chordName(step.chordId)}`, detail: 'Change, then strum once.' };
}

/** What the last attempt sounded like, for the step it was meant for. */
export function feedbackText(feedback: TrainerFeedback): string {
  const { heard, step } = feedback;
  if (feedback.correct) {
    if (step.kind === 'string') return `Yes! ${stringLabel(step.string)} rings clearly.`;
    return `Yes! That’s ${chordName(step.chordId)}.`;
  }
  if (heard?.kind === 'note' && step.kind === 'string') {
    const chord = CHORDS.get(step.chordId);
    const index = chord?.midis.findIndex((midi) => midi === heard.midi) ?? -1;
    const name = noteName(spellMidi(heard.midi));
    return index >= 0
      ? `That was ${name}, ${stringLabel(6 - index)}. Now pick ${stringLabel(step.string)}.`
      : `That was ${name}, not the note this string makes. Check the finger and fret.`;
  }
  if (heard?.kind === 'chord') {
    return `That sounded like ${chordName(heard.chordId)}. Check each finger and try again.`;
  }
  return 'That wasn’t clear. Let every string ring, then try again.';
}
