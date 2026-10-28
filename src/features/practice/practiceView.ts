import type { Exercise } from '@/content/exercises';
import type { ChordSegment, NoteEvent, Timeline } from './engine/timeline';
import type { BeatRange, TransportSettings } from './engine/transport';
import type { ExercisePrefs } from './practiceStore';

/** "1 & 2 & 3 & 4 &" in x/4 time, "1 2 3 4 5 6" in x/8 time. */
export function beatCounterLabels({ beatsPerBar, slotsPerBeat }: Timeline): string[] {
  return Array.from({ length: beatsPerBar * slotsPerBeat }, (_, slot) =>
    slot % slotsPerBeat === 0 ? String(slot / slotsPerBeat + 1) : '&',
  );
}

export function loopRange(prefs: ExercisePrefs, beatsPerBar: number): BeatRange | null {
  if (!prefs.loop) return null;
  return { start: (prefs.loop.startBar - 1) * beatsPerBar, end: prefs.loop.endBar * beatsPerBar };
}

export function transportSettings(
  prefs: ExercisePrefs,
  exercise: Exercise,
  beatsPerBar: number,
): TransportSettings {
  return {
    tempo: prefs.tempo,
    loop: loopRange(prefs, beatsPerBar),
    waitMode: prefs.waitMode,
    speedUp: prefs.speedUp ? { step: prefs.speedUpStep, target: exercise.tempo } : null,
  };
}

/**
 * The item after `index` within the playing range: wraps to the range start
 * when looping, null at the end.
 */
export function nextInRange<T extends ChordSegment | NoteEvent>(
  items: readonly T[],
  index: number,
  range: BeatRange,
  loops: boolean,
): T | null {
  const next = items[index + 1];
  if (next && next.beat < range.end) return next;
  if (!loops) return null;
  return items.find((item) => item.beat >= range.start) ?? null;
}

const STRING_NAMES = ['high e', 'B', 'G', 'D', 'A', 'low E'];

/** "string 6 (low E), fret 3" */
export function describeNote(note: Pick<NoteEvent, 'string' | 'fret'>): string {
  const fret = note.fret === 0 ? 'open' : `fret ${note.fret}`;
  return `string ${note.string} (${STRING_NAMES[note.string - 1] ?? ''}), ${fret}`;
}
