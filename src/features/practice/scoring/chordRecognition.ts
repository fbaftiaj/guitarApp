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

const isTriad = (id: string) => {
  const quality = CHORDS.get(id)?.quality;
  return quality === 'major' || quality === 'minor';
};

/**
 * The chord a strum sounds like, or null if nothing matches well enough.
 * Among chords within the margin of the best match a plain major or minor
 * chord wins, so a C major strum is named C rather than Cadd9, and E rather
 * than E5.
 */
export function recognizeChord(
  chroma: readonly number[],
  direction: 'down' | 'up' = 'down',
): TemplateMatch | null {
  const ranked = rankTemplates(chroma, templates[direction]);
  const best = ranked[0];
  if (!best || best.similarity < CHORD_MATCH.minSimilarity) return null;
  const close = ranked.filter((match) => match.similarity >= best.similarity - CHORD_MATCH.margin);
  return close.find((match) => isTriad(match.id)) ?? best;
}

export interface StrumJudgement {
  correct: boolean;
  /** The chord it sounded most like, if anything was clear enough. */
  heardId: string | null;
}

/** Judges one strum's chroma against `chordId`, played down or up. */
export function judgeStrum(chroma: readonly number[], chordId: string): StrumJudgement {
  if (checkChord(chroma, chordId, 'down').correct || checkChord(chroma, chordId, 'up').correct) {
    return { correct: true, heardId: chordId };
  }
  return { correct: false, heardId: recognizeChord(chroma)?.id ?? null };
}
