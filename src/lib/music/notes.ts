/**
 * Note names, frequencies and cents in twelve-tone equal temperament.
 * Octaves use scientific pitch notation (middle C = C4, A4 = MIDI 69).
 */

export const DEFAULT_A4_HZ = 440;
/** Range of concert-pitch references the app supports (A4 = 432 … 446 Hz). */
export const A4_RANGE_HZ = { min: 432, max: 446 } as const;
const A4_MIDI = 69;

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b';

/** A note as written, e.g. "Eb2": spelling matters for display (E♭, not D♯). */
export interface SpelledNote {
  letter: NoteLetter;
  accidental: Accidental;
  octave: number;
  /** MIDI note number (C4 = 60). */
  midi: number;
}

const LETTER_SEMITONES: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_SEMITONES: Record<Accidental, number> = { '': 0, '#': 1, b: -1 };
const SHARP_SPELLINGS: readonly (readonly [NoteLetter, Accidental])[] = [
  ['C', ''],
  ['C', '#'],
  ['D', ''],
  ['D', '#'],
  ['E', ''],
  ['F', ''],
  ['F', '#'],
  ['G', ''],
  ['G', '#'],
  ['A', ''],
  ['A', '#'],
  ['B', ''],
];

const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d)$/;
const PITCH_CLASS_PATTERN = /^([A-G])([#b]?)$/;

/** Pitch class (0 = C … 11 = B) of a name without octave, e.g. "F#" → 6; null if invalid. */
export function tryParsePitchClass(name: string): number | null {
  const match = PITCH_CLASS_PATTERN.exec(name);
  if (!match) return null;
  const semitones =
    LETTER_SEMITONES[match[1] as NoteLetter] + ACCIDENTAL_SEMITONES[match[2] as Accidental];
  return (semitones + 12) % 12;
}

/** Parses scientific pitch notation such as "E2", "F#3" or "Bb0"; null if invalid. */
export function tryParseNote(text: string): SpelledNote | null {
  const match = NOTE_PATTERN.exec(text);
  if (!match) return null;
  const letter = match[1] as NoteLetter;
  const accidental = match[2] as Accidental;
  const octave = Number(match[3]);
  const midi = (octave + 1) * 12 + LETTER_SEMITONES[letter] + ACCIDENTAL_SEMITONES[accidental];
  return { letter, accidental, octave, midi };
}

export function parseNote(text: string): SpelledNote {
  const note = tryParseNote(text);
  if (!note) throw new RangeError(`Invalid note "${text}"; expected e.g. "E2", "F#3" or "Bb1"`);
  return note;
}

/** Spells a MIDI note with sharps, as a chromatic tuner shows it. */
export function spellMidi(midi: number): SpelledNote {
  const pitchClass = ((midi % 12) + 12) % 12;
  const [letter, accidental] = SHARP_SPELLINGS[pitchClass] ?? ['C', ''];
  return { letter, accidental, octave: Math.floor(midi / 12) - 1, midi };
}

export function midiToFrequency(midi: number, a4 = DEFAULT_A4_HZ): number {
  return a4 * 2 ** ((midi - A4_MIDI) / 12);
}

/** Fractional MIDI number of a frequency. */
export function frequencyToMidi(frequency: number, a4 = DEFAULT_A4_HZ): number {
  return A4_MIDI + 12 * Math.log2(frequency / a4);
}

/** Signed distance from `reference` to `frequency` in cents (100 cents = 1 semitone). */
export function centsBetween(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}

export interface NearestNote {
  note: SpelledNote;
  /** Frequency of the nearest note. */
  frequency: number;
  /** Offset of the input from that note, −50 … +50 cents. */
  cents: number;
}

export function nearestNote(frequency: number, a4 = DEFAULT_A4_HZ): NearestNote {
  const exact = frequencyToMidi(frequency, a4);
  const midi = Math.round(exact);
  return {
    note: spellMidi(midi),
    frequency: midiToFrequency(midi, a4),
    cents: (exact - midi) * 100,
  };
}

const ACCIDENTAL_SYMBOLS: Record<Accidental, string> = { '': '', '#': '♯', b: '♭' };
const ACCIDENTAL_WORDS: Record<Accidental, string> = { '': '', '#': ' sharp', b: ' flat' };

/** "♭", "♯" or "". */
export function accidentalSymbol(accidental: Accidental): string {
  return ACCIDENTAL_SYMBOLS[accidental];
}

/** "E♭" — the pitch name without octave. */
export function noteName({
  letter,
  accidental,
}: Pick<SpelledNote, 'letter' | 'accidental'>): string {
  return letter + ACCIDENTAL_SYMBOLS[accidental];
}

/** "E♭2". */
export function noteLabel(note: SpelledNote): string {
  return `${noteName(note)}${note.octave}`;
}

/** "E flat 2", for screen readers. */
export function spokenNote(note: SpelledNote): string {
  return `${note.letter}${ACCIDENTAL_WORDS[note.accidental]} ${note.octave}`;
}
