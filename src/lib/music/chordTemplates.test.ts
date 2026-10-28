import { describe, expect, it } from 'vitest';
import { cosineSimilarity, rankTemplates, voicingTemplate } from './chordTemplates';

describe('voicingTemplate', () => {
  it('weights a note, its fifth (3rd harmonic) and its third (5th harmonic)', () => {
    const template = voicingTemplate([45]); // A2
    const [a, e, cSharp] = [template[9] ?? 0, template[4] ?? 0, template[1] ?? 0];
    expect(a).toBeGreaterThan(e);
    expect(e).toBeGreaterThan(cSharp);
    expect(cSharp).toBeGreaterThan(0);
    expect(template[0]).toBe(0); // no C
    expect(Math.hypot(...template)).toBeCloseTo(1, 12);
  });

  it('ignores muted strings and is silent for none', () => {
    expect(voicingTemplate([null, 45])).toEqual(voicingTemplate([45]));
    expect(voicingTemplate([null])).toEqual(new Array<number>(12).fill(0));
  });
});

describe('cosineSimilarity and rankTemplates', () => {
  it('measures similarity of chroma vectors', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 12);
    expect(cosineSimilarity(a, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(cosineSimilarity(a, new Array<number>(12).fill(0))).toBe(0);
  });

  it('ranks templates from the best match down', () => {
    const am = voicingTemplate([45, 52, 57, 60, 64]);
    const c = voicingTemplate([48, 52, 55, 60, 64]);
    const ranked = rankTemplates(
      am,
      new Map([
        ['C', c],
        ['Am', am],
      ]),
    );
    expect(ranked.map((match) => match.id)).toEqual(['Am', 'C']);
    expect(ranked[0]?.similarity).toBeCloseTo(1, 12);
  });
});
