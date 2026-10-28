// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findExercise, type Exercise } from '@/content/exercises';
import { compileExercise } from './engine/timeline';
import { defaultExercisePrefs } from './practiceStore';
import {
  beatCounterLabels,
  describeNote,
  loopRange,
  nextInRange,
  transportSettings,
} from './practiceView';

function exercise(id: string): Exercise {
  const found = findExercise(id);
  if (!found) throw new Error(`missing exercise ${id}`);
  return found;
}

describe('practice view helpers', () => {
  it('labels the beat counter by time signature', () => {
    expect(beatCounterLabels(compileExercise(exercise('em-am-changes')))).toEqual([
      ...['1', '&', '2', '&', '3', '&', '4', '&'],
    ]);
    expect(beatCounterLabels(compileExercise(exercise('am-e-waltz')))).toEqual([
      ...['1', '&', '2', '&', '3', '&'],
    ]);
  });

  it('turns loop bars into beats', () => {
    const prefs = {
      ...defaultExercisePrefs(exercise('am-e-waltz')),
      loop: { startBar: 2, endBar: 3 },
    };
    expect(loopRange(prefs, 3)).toEqual({ start: 3, end: 9 });
    expect(loopRange({ ...prefs, loop: null }, 3)).toBeNull();
  });

  it('builds transport settings, speeding up to the exercise tempo', () => {
    const em = exercise('em-am-changes');
    expect(transportSettings(defaultExercisePrefs(em), em, 4)).toEqual({
      tempo: 48,
      loop: null,
      waitMode: false,
      speedUp: { step: 5, target: 80 },
    });
  });

  it('finds the next chord, wrapping when looping', () => {
    const { chords } = compileExercise(exercise('em-am-changes'));
    const range = { start: 4, end: 12 };
    expect(nextInRange(chords, 1, range, true)?.beat).toBe(8);
    expect(nextInRange(chords, 2, range, true)?.beat).toBe(4);
    expect(nextInRange(chords, 7, { start: 0, end: 32 }, false)).toBeNull();
  });

  it('describes notes for screen readers', () => {
    expect(describeNote({ string: 6, fret: 3 })).toBe('string 6 (low E), fret 3');
    expect(describeNote({ string: 1, fret: 0 })).toBe('string 1 (high e), open');
  });
});
