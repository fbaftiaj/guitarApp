// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chordPitchClasses, shapeMidis, soundingPitchClasses, spokenChordName } from './chords';
import { tryParsePitchClass } from './notes';

describe('chords', () => {
  it('builds chord tones from root and quality', () => {
    expect(chordPitchClasses(9, 'minor')).toEqual([0, 4, 9]); // A C E
    expect(chordPitchClasses(7, 'dominant7')).toEqual([2, 5, 7, 11]); // G B D F
    expect(chordPitchClasses(4, 'power')).toEqual([4, 11]);
  });

  it('works out what a shape sounds in standard tuning', () => {
    const c = [null, 3, 2, 0, 1, 0];
    expect(shapeMidis(c)).toEqual([null, 48, 52, 55, 60, 64]);
    expect(soundingPitchClasses(c)).toEqual([0, 4, 7]);
  });

  it('spells names for screen readers', () => {
    expect(spokenChordName('A', 'minor')).toBe('A minor');
    expect(spokenChordName('Bb', 'major')).toBe('B flat major');
    expect(spokenChordName('F#', 'dominant7')).toBe('F sharp seven');
  });

  it('parses pitch-class names', () => {
    expect(['C', 'C#', 'Db', 'B', 'Cb', 'B#'].map(tryParsePitchClass)).toEqual([
      0, 1, 1, 11, 11, 0,
    ]);
    expect(tryParsePitchClass('H')).toBeNull();
    expect(tryParsePitchClass('E2')).toBeNull();
  });
});
