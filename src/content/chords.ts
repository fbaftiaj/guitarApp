import { z } from 'zod/mini';
import {
  chordPitchClasses,
  shapeMidis,
  soundingPitchClasses,
  spokenChordName,
  type ChordQuality,
} from '@/lib/music/chords';
import { tryParsePitchClass } from '@/lib/music/notes';
import chordsJson from './chords.json';

/**
 * Chord library (open and barre shapes in standard tuning), validated when
 * the module loads. Arrays run from the 6th string (low E) to the 1st.
 * Each shape must sound exactly the notes of its quality, which catches
 * typos in fret numbers.
 */

const stringFret = z.nullable(z.int().check(z.gte(0), z.lte(15)));
const finger = z.nullable(z.int().check(z.gte(1), z.lte(4)));
const stringNumber = z.int().check(z.gte(1), z.lte(6));

const chordSchema = z.object({
  id: z.string().check(z.regex(/^[A-G][#b]?[a-z0-9]*$/)),
  root: z.string().check(z.refine((root) => tryParsePitchClass(root) !== null, 'Invalid root')),
  quality: z.enum(['major', 'minor', 'dominant7', 'sus2', 'sus4', 'add9', 'power']),
  frets: z.array(stringFret).check(z.length(6)),
  fingers: z.array(finger).check(z.length(6)),
  barre: z.optional(
    z.object({ fret: z.int().check(z.gte(1)), fromString: stringNumber, toString: stringNumber }),
  ),
});

type ChordData = z.infer<typeof chordSchema>;

function checkChord(chord: ChordData, issues: string[]): void {
  const where = `chord "${chord.id}"`;
  chord.frets.forEach((fret, i) => {
    const fingerUsed = chord.fingers[i] ?? null;
    if ((fret === null || fret === 0) !== (fingerUsed === null)) {
      issues.push(`${where}: string ${6 - i} needs a finger exactly when it is fretted`);
    }
  });
  if (chord.barre) {
    const { fret, fromString, toString } = chord.barre;
    if (fromString <= toString) issues.push(`${where}: a barre runs from a lower string number`);
    for (let string = fromString; string >= toString; string--) {
      const stringFretted = chord.frets[6 - string] ?? null;
      if (stringFretted !== null && stringFretted < fret) {
        issues.push(`${where}: string ${string} is behind the barre`);
      }
    }
  }
  const root = tryParsePitchClass(chord.root) ?? 0;
  const expected = chordPitchClasses(root, chord.quality).join(',');
  if (soundingPitchClasses(chord.frets).join(',') !== expected) {
    issues.push(`${where}: the shape does not sound a ${chord.root} ${chord.quality} chord`);
  }
}

const libraryShape = z.object({ chords: z.array(chordSchema).check(z.minLength(1)) });
export const chordLibrarySchema = libraryShape.check(
  z.superRefine((library, ctx) => {
    const issues: string[] = [];
    const ids = new Set<string>();
    for (const chord of library.chords) {
      if (ids.has(chord.id)) issues.push(`duplicate chord id "${chord.id}"`);
      ids.add(chord.id);
      checkChord(chord, issues);
    }
    issues.forEach((issue) => {
      ctx.addIssue(issue);
    });
  }),
);

export interface Chord {
  id: string;
  /** Spoken name, e.g. "A minor". */
  name: string;
  root: string;
  quality: ChordQuality;
  /** Fret per string, 6th to 1st; null = muted, 0 = open. */
  frets: readonly (number | null)[];
  /** Fretting finger per string (1 = index … 4 = little), null when not fretted. */
  fingers: readonly (number | null)[];
  barre: { fret: number; fromString: number; toString: number } | null;
  /** Sounding MIDI note per string in standard tuning (null = muted). */
  midis: readonly (number | null)[];
  /** The chord's pitch classes (0 = C), e.g. for chord recognition. */
  pitchClasses: readonly number[];
}

export function parseChordLibrary(data: unknown): ReadonlyMap<string, Chord> {
  const result = chordLibrarySchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid chord library:\n${z.prettifyError(result.error)}`);
  return new Map(
    result.data.chords.map((chord) => [
      chord.id,
      {
        id: chord.id,
        name: spokenChordName(chord.root, chord.quality),
        root: chord.root,
        quality: chord.quality,
        frets: chord.frets,
        fingers: chord.fingers,
        barre: chord.barre ?? null,
        midis: shapeMidis(chord.frets),
        pitchClasses: chordPitchClasses(tryParsePitchClass(chord.root) ?? 0, chord.quality),
      },
    ]),
  );
}

export const CHORDS = parseChordLibrary(chordsJson);
