// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { noteLabel } from '@/lib/music/notes';
import {
  DEFAULT_INSTRUMENT_ID,
  INSTRUMENTS,
  findInstrument,
  instrumentLabel,
  parseInstrumentCatalog,
  resolveSelection,
} from './instruments';
import catalogJson from './instruments.json';

function tuningNotes(instrumentId: string, tuningId: string): string[] {
  const tuning = findInstrument(instrumentId)?.tunings.find((t) => t.id === tuningId);
  return tuning?.strings.map((string) => noteLabel(string.note)) ?? [];
}

describe('instrument catalog content', () => {
  it('offers every required instrument', () => {
    expect(INSTRUMENTS.map(instrumentLabel)).toEqual([
      'Guitar · 6-string',
      'Guitar · 7-string',
      'Guitar · 12-string',
      'Bass · 4-string',
      'Bass · 5-string',
      'Ukulele · 4-string',
    ]);
    expect(findInstrument('guitar-6')?.bodyStyles).toEqual(['acoustic', 'electric']);
  });

  it.each([
    ['standard', 'E2 A2 D3 G3 B3 E4'],
    ['drop-d', 'D2 A2 D3 G3 B3 E4'],
    ['drop-c', 'C2 G2 C3 F3 A3 D4'],
    ['half-step-down', 'E♭2 A♭2 D♭3 G♭3 B♭3 E♭4'],
    ['whole-step-down', 'D2 G2 C3 F3 A3 D4'],
    ['open-g', 'D2 G2 D3 G3 B3 D4'],
    ['open-d', 'D2 A2 D3 F♯3 A3 D4'],
    ['open-e', 'E2 B2 E3 G♯3 B3 E4'],
    ['dadgad', 'D2 A2 D3 G3 A3 D4'],
    ['open-c', 'C2 G2 C3 G3 C4 E4'],
  ])('has the 6-string %s tuning', (tuningId, notes) => {
    expect(tuningNotes('guitar-6', tuningId).join(' ')).toBe(notes);
  });

  it('tunes bass and ukulele correctly', () => {
    expect(tuningNotes('bass-4', 'standard').join(' ')).toBe('E1 A1 D2 G2');
    expect(tuningNotes('bass-5', 'standard').join(' ')).toBe('B0 E1 A1 D2 G2');
    expect(tuningNotes('ukulele', 'standard').join(' ')).toBe('G4 C4 E4 A4');
  });

  it('groups 12-string strings into six courses', () => {
    const tuning = findInstrument('guitar-12')?.tunings[0];
    expect(tuning?.strings.map((string) => string.course)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });
});

describe('parseInstrumentCatalog', () => {
  const valid = {
    instruments: [
      {
        id: 'test',
        family: 'guitar',
        name: 'Test',
        detail: '2-string',
        strings: 2,
        detection: { minHz: 50, maxHz: 1000 },
        defaultTuning: 'std',
        tunings: [{ id: 'std', name: 'Std', notes: ['E2', 'A2'] }],
      },
    ],
  };

  type Fixture = typeof valid;
  type InstrumentFixture = Fixture['instruments'][number];
  function only(c: Fixture): InstrumentFixture {
    const instrument = c.instruments[0];
    if (!instrument) throw new Error('fixture has no instrument');
    return instrument;
  }
  function std(c: Fixture): InstrumentFixture['tunings'][number] {
    const tuning = only(c).tunings[0];
    if (!tuning) throw new Error('fixture has no tuning');
    return tuning;
  }
  function variant(change: (copy: Fixture) => void): Fixture {
    const copy = structuredClone(valid);
    change(copy);
    return copy;
  }

  it('accepts the shipped catalog and a minimal one', () => {
    expect(() => parseInstrumentCatalog(catalogJson)).not.toThrow();
    expect(parseInstrumentCatalog(valid)[0]?.courseSize).toBe(1);
  });

  it.each([
    ['an invalid note', (c: Fixture) => (std(c).notes[0] = 'H2'), /Invalid note/],
    ['a wrong number of notes', (c: Fixture) => std(c).notes.push('D3'), /3 notes for 2 strings/],
    [
      'an unknown default tuning',
      (c: Fixture) => (only(c).defaultTuning = 'nope'),
      /defaultTuning "nope"/,
    ],
    [
      'a duplicate tuning id',
      (c: Fixture) => only(c).tunings.push({ ...std(c) }),
      /duplicate tuning id "std"/,
    ],
    [
      'a duplicate instrument id',
      (c: Fixture) => c.instruments.push(structuredClone(only(c))),
      /duplicate instrument id "test"/,
    ],
    [
      'a note outside the detection range',
      (c: Fixture) => (only(c).detection.minHz = 90),
      /E2 is outside the detection range/,
    ],
    ['a bad id', (c: Fixture) => (only(c).id = 'Not A Slug'), /id/],
  ])('rejects %s', (_case, change, message) => {
    expect(() => parseInstrumentCatalog(variant(change))).toThrow(message);
  });
});

describe('resolveSelection', () => {
  it('returns the stored instrument and tuning', () => {
    const { instrument, tuning } = resolveSelection('bass-4', 'drop-d');
    expect([instrument.id, tuning.id]).toEqual(['bass-4', 'drop-d']);
  });

  it('falls back to defaults for unknown ids', () => {
    expect(resolveSelection('banjo').instrument.id).toBe(DEFAULT_INSTRUMENT_ID);
    expect(resolveSelection('bass-4', 'removed-tuning').tuning.id).toBe('standard');
  });
});
