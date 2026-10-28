import { CHORDS } from '@/content/chords';
import type { Lesson } from '@/content/course';
import type { Exercise } from '@/content/exercises';
import { compileExercise, type NoteEvent, type StrumDirection } from '../practice/engine/timeline';
import type { FretMark } from '../practice/components/Fretboard';
import { chordFretMarks } from '../practice/practiceView';

/** The Learn step shows at most this many bars of tab and demo. */
export const DEMO_MAX_BARS = 4;

/** The lesson's exercise cut to its opening phrase, for tab and the demo. */
export function phraseExercise(lesson: Lesson): Exercise {
  const bars = Math.min(lesson.phraseBars, DEMO_MAX_BARS);
  const { exercise } = lesson;
  return exercise.kind === 'chords'
    ? { ...exercise, bars: exercise.bars.slice(0, bars) }
    : { ...exercise, bars: exercise.bars.slice(0, bars) };
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Chords to show as diagrams: a chord exercise's chords, or the chords a
 * note exercise picks through (every note of the bar is in the chord's
 * shape). A melody over backing chords shows none.
 */
export function lessonChords(exercise: Exercise): string[] {
  if (exercise.kind === 'chords') return unique(exercise.bars.flatMap((bar) => bar.chords));
  const held = exercise.bars.every((bar) => {
    const chord = bar.chord === null ? undefined : CHORDS.get(bar.chord);
    return (
      chord !== undefined &&
      bar.notes.every((note) => note.string === null || chord.frets[6 - note.string] === note.fret)
    );
  });
  return held ? unique(exercise.bars.flatMap((bar) => (bar.chord ? [bar.chord] : []))) : [];
}

export interface DemoFrame {
  /** 0-based bar and start beat within the exercise. */
  bar: number;
  beat: number;
  /** Beats until the next frame (the last one lasts to the end). */
  duration: number;
  marks: readonly FretMark[];
  chordId: string | null;
  direction: StrumDirection | null;
  note: NoteEvent | null;
}

/** One frame per strum or note, for the animated fretboard demo. */
export function demoFrames(exercise: Exercise): DemoFrame[] {
  const timeline = compileExercise(exercise);
  const end = timeline.totalBeats;
  const barOf = (beat: number) => Math.floor(beat / timeline.beatsPerBar);
  if (timeline.kind === 'chords') {
    return timeline.strums.map((strum, i) => ({
      bar: barOf(strum.beat),
      beat: strum.beat,
      duration: (timeline.strums[i + 1]?.beat ?? end) - strum.beat,
      marks: chordFretMarks(strum.chordId),
      chordId: strum.chordId,
      direction: strum.direction,
      note: null,
    }));
  }
  return timeline.notes.map((note, i) => ({
    bar: note.bar,
    beat: note.beat,
    duration: (timeline.notes[i + 1]?.beat ?? end) - note.beat,
    marks: [{ string: note.string, fret: note.fret, finger: note.finger, midi: note.midi }],
    chordId: null,
    direction: null,
    note,
  }));
}
