// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { StreamingChroma, type ChromaEvent } from '@/audio/dsp/chroma';
import { CHORDS } from '@/content/chords';
import { mix, strum } from '@/test/guitarSignals';
import { judgeStrum } from './chordRecognition';

const RATE = 48_000;

/** The chroma the analysis worklet reports after strumming `chordId`. */
function chromaOf(chordId: string, direction: 'down' | 'up' = 'down'): number[] {
  const midis = CHORDS.get(chordId)?.midis ?? [];
  const signal = mix(
    RATE,
    1,
    [{ time: 0.3, signal: strum({ midis, sampleRate: RATE, direction }) }],
    {
      noise: 0.002,
    },
  );
  const analysis = new StreamingChroma(RATE);
  analysis.capture(0.3);
  const events: ChromaEvent[] = [];
  for (let i = 0; i < signal.length; i += 128) {
    analysis.push(signal.subarray(i, i + 128), i / RATE, (event) => events.push(event));
  }
  return events[0]?.chroma ?? [];
}

describe('judgeStrum', () => {
  it('accepts the right chord, strummed down or up', () => {
    expect(judgeStrum(chromaOf('Em'), 'Em')).toEqual({ correct: true, heardId: 'Em' });
    expect(judgeStrum(chromaOf('G', 'up'), 'G')).toEqual({ correct: true, heardId: 'G' });
  });

  it('names the chord it heard instead', () => {
    expect(judgeStrum(chromaOf('C'), 'Am')).toEqual({ correct: false, heardId: 'C' });
    expect(judgeStrum(chromaOf('E'), 'Em')).toEqual({ correct: false, heardId: 'E' });
  });

  it('hears nothing clear in silence', () => {
    expect(judgeStrum(new Array<number>(12).fill(0), 'G')).toEqual({
      correct: false,
      heardId: null,
    });
  });
});
