// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  centsBetween,
  frequencyToMidi,
  midiToFrequency,
  nearestNote,
  noteLabel,
  noteName,
  parseNote,
  spellMidi,
  spokenNote,
  tryParseNote,
} from './notes';

describe('parseNote', () => {
  it.each([
    ['A4', 69],
    ['C4', 60],
    ['E2', 40],
    ['B0', 23],
    ['C#3', 49],
    ['Eb2', 39],
    ['Cb4', 59],
    ['B#3', 60],
    ['C-1', 0],
  ])('%s is MIDI %i', (text, midi) => {
    expect(parseNote(text).midi).toBe(midi);
  });

  it('keeps the spelling', () => {
    expect(parseNote('Eb2')).toEqual({ letter: 'E', accidental: 'b', octave: 2, midi: 39 });
  });

  it.each(['', 'H2', 'E', 'e2', 'E##2', 'E2b', 'Ebb2', 'E10'])('rejects %j', (text) => {
    expect(tryParseNote(text)).toBeNull();
    expect(() => parseNote(text)).toThrow(RangeError);
  });
});

describe('frequency conversion', () => {
  it.each([
    ['E2', 82.4069],
    ['A2', 110],
    ['D3', 146.8324],
    ['G3', 195.9977],
    ['B3', 246.9417],
    ['E4', 329.6276],
    ['A4', 440],
    ['B0', 30.8677],
    ['E1', 41.2034],
  ])('%s is %f Hz at A4 = 440', (text, hz) => {
    expect(midiToFrequency(parseNote(text).midi)).toBeCloseTo(hz, 3);
  });

  it('scales with the reference pitch', () => {
    expect(midiToFrequency(69, 432)).toBe(432);
    expect(midiToFrequency(57, 446)).toBeCloseTo(223, 6);
  });

  it('round-trips between MIDI and frequency', () => {
    for (const a4 of [432, 440, 446]) {
      for (let midi = 20; midi <= 100; midi += 7) {
        expect(frequencyToMidi(midiToFrequency(midi, a4), a4)).toBeCloseTo(midi, 9);
      }
    }
  });

  it('measures cents', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 9);
    expect(centsBetween(440, 880)).toBeCloseTo(-1200, 9);
    expect(centsBetween(440 * 2 ** (1 / 1200), 440)).toBeCloseTo(1, 9);
  });
});

describe('nearestNote', () => {
  it('finds the note and the offset in cents', () => {
    const flatA = nearestNote(440 * 2 ** (-12 / 1200));
    expect(noteLabel(flatA.note)).toBe('A4');
    expect(flatA.cents).toBeCloseTo(-12, 6);
    expect(flatA.frequency).toBeCloseTo(440, 9);

    const sharpE = nearestNote(82.4069 * 2 ** (30 / 1200));
    expect(noteLabel(sharpE.note)).toBe('E2');
    expect(sharpE.cents).toBeCloseTo(30, 2);
  });

  it('switches note half way between semitones', () => {
    expect(noteLabel(nearestNote(440 * 2 ** (49 / 1200)).note)).toBe('A4');
    expect(noteLabel(nearestNote(440 * 2 ** (51 / 1200)).note)).toBe('A♯4');
  });

  it('honours the reference pitch', () => {
    const result = nearestNote(440, 442);
    expect(noteLabel(result.note)).toBe('A4');
    expect(result.cents).toBeCloseTo(-7.85, 2);
  });
});

describe('formatting', () => {
  it('spells chromatic notes with sharps', () => {
    expect([...Array(12).keys()].map((i) => noteName(spellMidi(60 + i)))).toEqual([
      'C',
      'C♯',
      'D',
      'D♯',
      'E',
      'F',
      'F♯',
      'G',
      'G♯',
      'A',
      'A♯',
      'B',
    ]);
    expect(noteLabel(spellMidi(23))).toBe('B0');
    expect(noteLabel(spellMidi(-1))).toBe('B-2');
  });

  it('labels notes for display and for screen readers', () => {
    const note = parseNote('Eb2');
    expect(noteLabel(note)).toBe('E♭2');
    expect(spokenNote(note)).toBe('E flat 2');
    expect(spokenNote(parseNote('F#3'))).toBe('F sharp 3');
    expect(spokenNote(parseNote('A4'))).toBe('A 4');
  });
});
