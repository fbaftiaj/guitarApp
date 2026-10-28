/**
 * Chord templates for chroma-based recognition: the pitch-class profile a
 * voicing is expected to produce. Each template runs the same analysis as
 * the chroma of a real sound (see `computeChroma`) on an idealised spectrum,
 * so overtones (octaves, the fifth above, the third two octaves up …) and
 * partials shared by several strings are weighted the way they are heard.
 */

/** Must match the chroma analysis band and compression. */
const BAND_HZ = { min: 75, max: 2000 } as const;
const COMPRESSION = 300;
const RELATIVE_FLOOR = 0.01;
/** Partials of a plucked string fall off roughly as 1/n. */
const STRING_LEVEL = 0.2;

function midiFrequency(midi: number, a4: number): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Expected chroma (12 values, unit length) of the notes `midis` (nulls ignored). */
export function voicingTemplate(midis: readonly (number | null)[], a4 = 440): number[] {
  // Partials that land on the same frequency (within 5 cents) form one spectral peak.
  const partials = new Map<number, { pitch: number; amplitude: number }>();
  for (const midi of midis) {
    if (midi === null) continue;
    const fundamental = midiFrequency(midi, a4);
    for (let harmonic = 1; fundamental * harmonic <= BAND_HZ.max; harmonic++) {
      if (fundamental * harmonic < BAND_HZ.min) continue;
      const pitch = midi + 12 * Math.log2(harmonic);
      const key = Math.round(pitch * 20);
      const amplitude = STRING_LEVEL / harmonic;
      const existing = partials.get(key);
      if (existing) existing.amplitude += amplitude;
      else partials.set(key, { pitch, amplitude });
    }
  }
  const loudest = Math.max(0, ...[...partials.values()].map((p) => p.amplitude));
  const template = new Array<number>(12).fill(0);
  for (const { pitch, amplitude } of partials.values()) {
    if (amplitude < loudest * RELATIVE_FLOOR) continue;
    const nearest = Math.round(pitch);
    const closeness = Math.max(0, 1 - 2 * Math.abs(pitch - nearest));
    const pitchClass = ((nearest % 12) + 12) % 12;
    template[pitchClass] =
      (template[pitchClass] ?? 0) + Math.log1p(COMPRESSION * amplitude) * closeness;
  }
  return normalize(template);
}

function normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

/** Cosine similarity of two 12-value vectors (0 when either is silent). */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA > 0 && normB > 0 ? dot / Math.sqrt(normA * normB) : 0;
}

export interface TemplateMatch {
  id: string;
  similarity: number;
}

/** Templates ordered from the best to the worst match for `chroma`. */
export function rankTemplates(
  chroma: readonly number[],
  templates: ReadonlyMap<string, readonly number[]>,
): TemplateMatch[] {
  return [...templates]
    .map(([id, template]) => ({ id, similarity: cosineSimilarity(chroma, template) }))
    .sort((a, b) => b.similarity - a.similarity);
}
