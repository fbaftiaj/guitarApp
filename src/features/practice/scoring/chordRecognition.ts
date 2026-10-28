import { CHORDS } from '@/content/chords';
import { rankTemplates, voicingTemplate, type TemplateMatch } from '@/lib/music/chordTemplates';

/**
 * Chord recognition from a chroma vector: every chord in the library has a
 * template for down-strums (all strings) and up-strums (the four treble
 * strings an up-strum catches). The expected chord is accepted when it is
 * close enough to the best match: chords one note apart (C and Cadd9) can be
 * this close, while the pairs beginners mix up (Em/E, Am/C) are far apart.
 */

export const CHORD_MATCH = {
  /** Cosine similarity the expected chord needs at least. */
  minSimilarity: 0.8,
  /** How far below the best-matching chord the expected one may score. */
  margin: 0.03,
} as const;

/** Treble strings an up-strum catches (see the practice synth and arrangement). */
const UP_STRUM_STRINGS = 4;

function sounding(midis: readonly (number | null)[]): number[] {
  return midis.flatMap((midi) => (midi === null ? [] : [midi]));
}

const templates = {
  down: new Map([...CHORDS].map(([id, chord]) => [id, voicingTemplate(chord.midis)])),
  up: new Map(
    [...CHORDS].map(([id, chord]) => [
      id,
      voicingTemplate(sounding(chord.midis).slice(-UP_STRUM_STRINGS)),
    ]),
  ),
};

export interface ChordCheck {
  correct: boolean;
  /** Similarity of the expected chord. */
  similarity: number;
  best: TemplateMatch | null;
}

export function checkChord(
  chroma: readonly number[],
  expectedId: string,
  direction: 'down' | 'up' = 'down',
): ChordCheck {
  const ranked = rankTemplates(chroma, templates[direction]);
  const best = ranked[0] ?? null;
  const similarity = ranked.find((match) => match.id === expectedId)?.similarity ?? 0;
  const correct =
    best !== null &&
    similarity >= CHORD_MATCH.minSimilarity &&
    similarity >= best.similarity - CHORD_MATCH.margin;
  return { correct, similarity, best };
}
