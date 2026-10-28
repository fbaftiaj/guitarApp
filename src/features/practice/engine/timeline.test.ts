// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findExercise, type Exercise } from '@/content/exercises';
import { compileExercise, indexAtBeat } from './timeline';

function exercise(id: string): Exercise {
  const found = findExercise(id);
  if (!found) throw new Error(`missing exercise ${id}`);
  return found;
}

describe('compileExercise', () => {
  it('lays chord bars out on the beat axis', () => {
    const timeline = compileExercise(exercise('em-am-changes'));
    expect(timeline).toMatchObject({
      kind: 'chords',
      beatsPerBar: 4,
      slotsPerBeat: 2,
      totalBars: 8,
      totalBeats: 32,
      targetTempo: 80,
    });
    expect(timeline.chords.map((c) => [c.beat, c.duration, c.chordId])).toEqual(
      [0, 4, 8, 12, 16, 20, 24, 28].map((beat, i) => [beat, 4, i % 2 === 0 ? 'Em' : 'Am']),
    );
    expect(timeline.strums).toHaveLength(32);
    expect(timeline.strums.slice(0, 5)).toEqual([
      { beat: 0, direction: 'down', chordId: 'Em' },
      { beat: 1, direction: 'down', chordId: 'Em' },
      { beat: 2, direction: 'down', chordId: 'Em' },
      { beat: 3, direction: 'down', chordId: 'Em' },
      { beat: 4, direction: 'down', chordId: 'Am' },
    ]);
    expect(timeline.targets).toEqual([0, 4, 8, 12, 16, 20, 24, 28]);
  });

  it('places up-strums on the off-beats', () => {
    const timeline = compileExercise(exercise('g-c-d-folk'));
    const bar = timeline.strums.filter((s) => s.beat < 4);
    expect(bar.map((s) => [s.beat, s.direction])).toEqual([
      [0, 'down'],
      [1, 'down'],
      [1.5, 'up'],
      [2.5, 'up'],
      [3, 'down'],
      [3.5, 'up'],
    ]);
  });

  it('splits a bar between its chords', () => {
    const timeline = compileExercise(exercise('a-d-half-bars'));
    expect(timeline.chords.slice(0, 3)).toEqual([
      { index: 0, bar: 0, beat: 0, duration: 2, chordId: 'A' },
      { index: 1, bar: 0, beat: 2, duration: 2, chordId: 'D' },
      { index: 2, bar: 1, beat: 4, duration: 2, chordId: 'A' },
    ]);
    const chordsOfStrums = timeline.strums.filter((s) => s.beat < 4).map((s) => s.chordId);
    expect(chordsOfStrums).toEqual(['A', 'A', 'A', 'A', 'D', 'D', 'D', 'D']);
  });

  it('handles three beats to the bar', () => {
    const timeline = compileExercise(exercise('am-e-waltz'));
    expect(timeline.beatsPerBar).toBe(3);
    expect(timeline.totalBeats).toBe(24);
    // The last bar is a single strum held for the whole bar.
    expect(timeline.strums.filter((s) => s.beat >= 21)).toEqual([
      { beat: 21, direction: 'down', chordId: 'Am' },
    ]);
  });

  it('turns note bars into notes with MIDI pitches, skipping rests', () => {
    const timeline = compileExercise(exercise('e-minor-riff'));
    expect(timeline.kind).toBe('notes');
    expect(timeline.notes).toHaveLength(28);
    expect(timeline.notes[2]).toEqual({
      index: 2,
      bar: 0,
      beat: 1,
      duration: 0.5,
      string: 6,
      fret: 3,
      finger: 3,
      midi: 43,
    });
    // Bar 2: a quarter note at beat 6, a rest at 7, the last note at 7.5.
    const bar2 = timeline.notes.filter((n) => n.bar === 1);
    expect(bar2.map((n) => n.beat)).toEqual([4, 4.5, 5, 5.5, 6, 7.5]);
    expect(timeline.chords).toHaveLength(4);
    expect(timeline.targets).toEqual(timeline.notes.map((n) => n.beat));
  });

  it('gives open strings their standard-tuning pitch', () => {
    const timeline = compileExercise(exercise('open-strings'));
    expect(timeline.notes.slice(0, 6).map((n) => n.midi)).toEqual([40, 45, 50, 55, 59, 64]);
  });
});

describe('indexAtBeat', () => {
  const items = [{ beat: 0 }, { beat: 2 }, { beat: 4 }];

  it.each([
    [-1, -1],
    [0, 0],
    [1.9, 0],
    [2, 1],
    [3.99, 1],
    [100, 2],
  ])('at beat %f is %i', (beat, index) => {
    expect(indexAtBeat(items, beat)).toBe(index);
  });

  it('returns -1 for no items', () => {
    expect(indexAtBeat([], 3)).toBe(-1);
  });
});
