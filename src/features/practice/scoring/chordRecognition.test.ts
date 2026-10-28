// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { StreamingChroma, type ChromaEvent } from '@/audio/dsp/chroma';
import { CHORDS } from '@/content/chords';
import { mix, strum } from '@/test/guitarSignals';
import { checkChord } from './chordRecognition';

const STAGE_2 = ['Em', 'Am', 'E', 'A', 'D', 'G', 'C'] as const;

interface Take {
  chord: string;
  sampleRate: number;
  direction?: 'down' | 'up';
  brightness?: number;
  noise?: number;
  /** Cents the guitar is out of tune with the reference pitch. */
  detune?: number;
  /** A previous chord still ringing underneath. */
  ringing?: string;
}

/** Strums a chord and returns the chroma the practicer would compute after the onset. */
function chromaOf({
  chord,
  sampleRate,
  direction = 'down',
  brightness = 0.7,
  noise = 0.002,
  detune = 0,
  ringing,
}: Take): number[] {
  const shape = (id: string) =>
    (CHORDS.get(id)?.midis ?? []).map((midi) => (midi === null ? null : midi + detune / 100));
  const parts = [
    {
      time: 0.3,
      signal: strum({ midis: shape(chord), sampleRate, direction, brightness, seed: 5 }),
    },
  ];
  if (ringing) {
    parts.push({
      time: 0,
      signal: strum({ midis: shape(ringing), sampleRate, level: 0.1, seed: 2 }),
    });
  }
  const signal = mix(sampleRate, 1, parts, { noise });
  const analysis = new StreamingChroma(sampleRate);
  analysis.capture(0.3);
  const events: ChromaEvent[] = [];
  for (let i = 0; i < signal.length; i += 128) {
    analysis.push(signal.subarray(i, i + 128), i / sampleRate, (event) => events.push(event));
  }
  expect(events).toHaveLength(1);
  return events[0]?.chroma ?? [];
}

const VARIANTS: [string, Partial<Take>][] = [
  ['as is', {}],
  ['bright strings', { brightness: 0.95 }],
  ['dull strings', { brightness: 0.35 }],
  ['a noisy room', { noise: 0.008 }],
  ['tuned 12 cents sharp', { detune: 12 }],
  ['tuned to A4 = 432 Hz', { detune: -31.8 }],
];

describe.each([44_100, 48_000])('chord recognition at %i Hz', (sampleRate) => {
  describe.each(VARIANTS)('with %s', (_name, variant) => {
    it.each(STAGE_2)('recognises %s strummed down and up', (chord) => {
      for (const direction of ['down', 'up'] as const) {
        const check = checkChord(
          chromaOf({ chord, sampleRate, direction, ...variant }),
          chord,
          direction,
        );
        expect(check.correct, `${chord} ${direction}: best ${check.best?.id}`).toBe(true);
      }
    });
  });

  it.each(STAGE_2)('recognises %s over the previous chord still ringing', (chord) => {
    const ringing = STAGE_2[(STAGE_2.indexOf(chord) + 1) % STAGE_2.length] ?? 'Em';
    expect(checkChord(chromaOf({ chord, sampleRate, ringing }), chord).correct).toBe(true);
  });

  it.each([
    ['Em', 'E'],
    ['E', 'Em'],
    ['Am', 'C'],
    ['C', 'Am'],
    ['G', 'C'],
    ['D', 'A'],
  ])('tells %s from %s', (played, expected) => {
    for (const direction of ['down', 'up'] as const) {
      const chroma = chromaOf({ chord: played, sampleRate, direction });
      expect(checkChord(chroma, expected, direction).correct).toBe(false);
      expect(checkChord(chroma, played, direction).correct).toBe(true);
    }
  });

  it('accepts every chord in the library as itself', () => {
    for (const id of CHORDS.keys()) {
      expect(checkChord(chromaOf({ chord: id, sampleRate }), id).correct, id).toBe(true);
    }
  });
});

describe('checkChord', () => {
  it('rejects silence', () => {
    expect(checkChord(new Array<number>(12).fill(0), 'Em')).toMatchObject({ correct: false });
  });
});
