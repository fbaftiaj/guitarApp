// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHORDS, parseChordLibrary } from './chords';
import chordsJson from './chords.json';

describe('chord library', () => {
  it('contains every Stage 2 open chord', () => {
    for (const id of ['Em', 'Am', 'E', 'A', 'D', 'G', 'C']) expect(CHORDS.has(id)).toBe(true);
  });

  it('resolves the sounding notes and the chord tones', () => {
    const am = CHORDS.get('Am');
    expect(am?.midis).toEqual([null, 45, 52, 57, 60, 64]);
    expect(am?.pitchClasses).toEqual([0, 4, 9]);
    expect(am?.name).toBe('A minor');
    expect(CHORDS.get('F')?.barre).toEqual({ fret: 1, fromString: 6, toString: 1 });
  });

  const base = {
    id: 'Em',
    root: 'E',
    quality: 'minor',
    frets: [0, 2, 2, 0, 0, 0],
    fingers: [null, 2, 3, null, null, null],
  };

  it('accepts the shipped library and a valid chord', () => {
    expect(() => parseChordLibrary(chordsJson)).not.toThrow();
    expect(() => parseChordLibrary({ chords: [base] })).not.toThrow();
  });

  it.each([
    [
      'a wrong fret (shape is not the chord)',
      { frets: [0, 2, 2, 1, 0, 0] },
      /does not sound a E minor/,
    ],
    [
      'a fretted string without a finger',
      { fingers: [null, 2, null, null, null, null] },
      /needs a finger/,
    ],
    ['a finger on an open string', { fingers: [1, 2, 3, null, null, null] }, /needs a finger/],
    ['five strings', { frets: [0, 2, 2, 0, 0] }, /frets/],
    [
      'a string behind the barre',
      {
        frets: [1, 3, 3, 2, 0, 1],
        fingers: [1, 3, 4, 2, null, 1],
        root: 'F',
        quality: 'major',
        barre: { fret: 1, fromString: 6, toString: 1 },
      },
      /behind the barre/,
    ],
  ])('rejects %s', (_case, change, message) => {
    expect(() => parseChordLibrary({ chords: [{ ...base, ...change }] })).toThrow(message);
  });

  it('rejects duplicate ids', () => {
    expect(() => parseChordLibrary({ chords: [base, base] })).toThrow(/duplicate chord id "Em"/);
  });
});
