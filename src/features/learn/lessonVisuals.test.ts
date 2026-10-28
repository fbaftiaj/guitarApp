// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findLesson, type Lesson } from '@/content/course';
import { demoFrames, lessonChords, phraseExercise } from './lessonVisuals';

function lesson(id: string): Lesson {
  const found = findLesson(id);
  if (!found) throw new Error(`no lesson ${id}`);
  return found;
}

describe('lesson visuals', () => {
  it('shows a chord exercise’s chords once each, in order', () => {
    expect(lessonChords(lesson('four-chord-loop').exercise)).toEqual(['Em', 'C', 'G', 'D']);
  });

  it('shows the chord a note exercise picks through, but not a melody’s backing', () => {
    expect(lessonChords(lesson('reading-chord-diagrams').exercise)).toEqual(['Em']);
    expect(lessonChords(lesson('clean-fretting').exercise)).toEqual(['Am']);
    expect(lessonChords(lesson('your-first-melody').exercise)).toEqual([]);
    expect(lessonChords(lesson('parts-of-the-guitar').exercise)).toEqual([]);
  });

  it('cuts the exercise to its opening phrase', () => {
    expect(phraseExercise(lesson('changing-em-am')).bars).toHaveLength(2);
    // A song lesson demos its first section, at most four bars of it.
    expect(phraseExercise(lesson('stage-2-song')).bars).toHaveLength(4);
  });

  it('makes one frame per strum, lasting until the next', () => {
    const frames = demoFrames(phraseExercise(lesson('up-strums')));
    expect(frames.slice(0, 5).map((f) => [f.beat, f.duration, f.direction])).toEqual([
      [0, 1, 'down'],
      [1, 1, 'down'],
      [2, 1, 'down'],
      [3, 0.5, 'down'],
      [3.5, 0.5, 'up'],
    ]);
    expect(frames[0]?.chordId).toBe('Em');
    expect(frames[0]?.marks).toHaveLength(6);
  });

  it('makes one frame per note, with its fret and finger', () => {
    const frames = demoFrames(phraseExercise(lesson('frets-and-fretting')));
    expect(frames.map((f) => f.marks[0])).toEqual([
      { string: 1, fret: 0, finger: null, midi: 64 },
      { string: 1, fret: 1, finger: 1, midi: 65 },
      { string: 1, fret: 3, finger: 3, midi: 67 },
      { string: 1, fret: 1, finger: 1, midi: 65 },
    ]);
    // Rests belong to the note before them.
    const counting = demoFrames(phraseExercise(lesson('counting-beats')));
    expect(counting.at(-2)?.duration).toBe(2);
  });
});
