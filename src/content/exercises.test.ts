// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHORDS } from './chords';
import { EXERCISES, findExercise, parseExerciseCatalog, slotsPerBeat } from './exercises';
import exercisesJson from './exercises.json';

const chordExercise = {
  id: 'test-chords',
  kind: 'chords',
  title: 'Test',
  description: 'Test exercise.',
  skills: ['chords'],
  timeSignature: { beats: 4, unit: 4 },
  tempo: 80,
  strum: 'quarters',
  bars: [{ chords: ['Em'] }],
};

const noteExercise = {
  id: 'test-notes',
  kind: 'notes',
  title: 'Test',
  description: 'Test exercise.',
  skills: ['singleNotes'],
  timeSignature: { beats: 4, unit: 4 },
  tempo: 80,
  bars: [{ notes: [{ string: 6, fret: 0, beats: 2 }, { beats: 2 }] }],
};

function catalog(...exercises: object[]) {
  return { strumPatterns: { quarters: 'D.D.D.D.' }, exercises };
}

describe('exercise catalog', () => {
  it('parses the shipped catalog with unique ids', () => {
    expect(() => parseExerciseCatalog(exercisesJson)).not.toThrow();
    expect(EXERCISES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });

  it('only references chords in the chord library', () => {
    for (const exercise of EXERCISES) {
      const ids =
        exercise.kind === 'chords'
          ? exercise.bars.flatMap((bar) => bar.chords)
          : exercise.bars.flatMap((bar) => (bar.chord ? [bar.chord] : []));
      for (const id of ids) expect(CHORDS.has(id), `${exercise.id}: ${id}`).toBe(true);
    }
  });

  it('expands repeats and resolves named strum patterns', () => {
    const exercise = findExercise('g-c-d-folk');
    expect(exercise?.kind).toBe('chords');
    if (exercise?.kind !== 'chords') return;
    expect(exercise.bars).toHaveLength(8);
    expect(exercise.bars.map((bar) => bar.chords[0])).toEqual([
      ...['G', 'C', 'D', 'G'],
      ...['G', 'C', 'D', 'G'],
    ]);
    expect(exercise.bars[0]?.strum).toBe('D.DU.UDU');
  });

  it('uses a bar’s own strum over the exercise default', () => {
    const waltz = findExercise('am-e-waltz');
    if (waltz?.kind !== 'chords') throw new Error('expected a chord exercise');
    expect(waltz.bars[0]?.strum).toBe('D.D.D.');
    expect(waltz.bars.at(-1)?.strum).toBe('D.....');
  });

  it('fills note bars with nulls for rests and missing fingers', () => {
    const riff = findExercise('e-minor-riff');
    if (riff?.kind !== 'notes') throw new Error('expected a note exercise');
    expect(riff.bars).toHaveLength(4);
    expect(riff.bars[0]?.notes[0]).toEqual({ beats: 0.5, string: 6, fret: 0, finger: null });
    expect(riff.bars[1]?.notes).toContainEqual({
      beats: 0.5,
      string: null,
      fret: null,
      finger: null,
    });
  });

  it('counts strum slots per beat from the time signature', () => {
    expect(slotsPerBeat({ beats: 4, unit: 4 })).toBe(2);
    expect(slotsPerBeat({ beats: 6, unit: 8 })).toBe(1);
  });

  it('returns undefined for an unknown id', () => {
    expect(findExercise('nope')).toBeUndefined();
  });

  it('accepts minimal valid exercises', () => {
    expect(() => parseExerciseCatalog(catalog(chordExercise, noteExercise))).not.toThrow();
  });

  it.each([
    ['an unknown chord', { bars: [{ chords: ['Xm'] }] }, /unknown chord "Xm"/],
    ['an unknown strum pattern', { strum: 'nope' }, /unknown strum pattern "nope"/],
    ['a pattern of the wrong length', { strum: 'D.D.' }, /has 4 slots, needs 8/],
    [
      'chords that do not split the bar',
      { bars: [{ chords: ['Em', 'Am', 'C'] }] },
      /3 chords do not split 4 beats/,
    ],
    ['a tempo out of range', { tempo: 400 }, /tempo/],
    ['an unknown skill', { skills: ['juggling'] }, /skills/],
    ['a bad id', { id: 'Not A Slug' }, /id/],
  ])('rejects a chord exercise with %s', (_case, change, message) => {
    expect(() => parseExerciseCatalog(catalog({ ...chordExercise, ...change }))).toThrow(message);
  });

  it.each([
    [
      'notes that do not fill the bar',
      { bars: [{ notes: [{ string: 6, fret: 0, beats: 3 }] }] },
      /notes last 3 beats, the bar has 4/,
    ],
    [
      'a string without a fret',
      { bars: [{ notes: [{ string: 6, beats: 4 }] }] },
      /give both string and fret/,
    ],
    [
      'a finger on an open string',
      { bars: [{ notes: [{ string: 6, fret: 0, finger: 1, beats: 4 }] }] },
      /a finger needs a fretted note/,
    ],
    [
      'an unknown backing chord',
      { bars: [{ chord: 'H', notes: [{ beats: 4 }] }] },
      /unknown chord "H"/,
    ],
    ['string 7', { bars: [{ notes: [{ string: 7, fret: 0, beats: 4 }] }] }, /string/],
  ])('rejects a note exercise with %s', (_case, change, message) => {
    expect(() => parseExerciseCatalog(catalog({ ...noteExercise, ...change }))).toThrow(message);
  });

  it('rejects duplicate ids', () => {
    expect(() => parseExerciseCatalog(catalog(chordExercise, chordExercise))).toThrow(
      /duplicate exercise id "test-chords"/,
    );
  });
});
