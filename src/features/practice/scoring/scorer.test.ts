// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHORDS } from '@/content/chords';
import { voicingTemplate } from '@/lib/music/chordTemplates';
import { midiToFrequency } from '@/lib/music/notes';
import type { Expected } from './hitCheck';
import { Scorer, type Hit, type ScoringTarget } from './scorer';

const LATENCY = 0.05;

function chromaOf(chordId: string): number[] {
  return voicingTemplate(CHORDS.get(chordId)?.midis ?? []);
}

let nextId = 0;
function target(
  time: number,
  expected: Expected,
  extra: Partial<ScoringTarget> = {},
): ScoringTarget {
  nextId++;
  return {
    id: nextId,
    index: nextId,
    pass: 1,
    time,
    expected,
    label: expected.kind === 'chord' ? expected.chordId : String(expected.midi),
    change: false,
    ...extra,
  };
}

const em: Expected = { kind: 'chord', chordId: 'Em', direction: 'down' };

function setup() {
  const events: Hit[] = [];
  const scorer = new Scorer({ latency: LATENCY, a4: 440, onHit: (hit) => events.push(hit) });
  /** The player strums at `time` (as heard on the audio clock), with `chord` coming through. */
  const strum = (time: number, chord = 'Em') => {
    const onsetTime = time + LATENCY;
    scorer.addOnset({ time: onsetTime, strength: 1 });
    scorer.addChroma({ onsetTime, chroma: chromaOf(chord) });
  };
  return { scorer, events, strum };
}

describe('Scorer', () => {
  it('judges timing after removing the latency, then checks the chord', () => {
    const { scorer, strum, events } = setup();
    [1, 1.5, 2, 2.5].forEach((time) => {
      scorer.addTarget(target(time, em));
    });
    strum(1.01);
    strum(1.56);
    strum(1.87);
    strum(2.63);
    scorer.update(10);

    expect(scorer.hits.map((hit) => [hit.timing, hit.correct])).toEqual([
      ['perfect', true],
      ['good', true],
      ['early', true],
      ['late', true],
    ]);
    expect(scorer.hits[1]?.deviation).toBeCloseTo(0.06, 9);
    // Each hit is reported when timed, then again when its chord is checked.
    expect(events.filter((hit) => !hit.final)).toHaveLength(4);
    expect(events.filter((hit) => hit.final)).toHaveLength(4);
  });

  it('calls a miss once the window and the latency have passed', () => {
    const { scorer, events } = setup();
    scorer.addTarget(target(1, em));
    scorer.update(1.29);
    expect(scorer.hits).toEqual([]);
    scorer.update(1.31);
    expect(scorer.hits).toMatchObject([{ timing: 'miss', deviation: null, correct: false }]);
    expect(events).toHaveLength(1);
  });

  it('marks the wrong chord, played on time', () => {
    const { scorer, strum } = setup();
    scorer.addTarget(target(1, em));
    strum(1, 'E');
    expect(scorer.hits).toMatchObject([{ timing: 'perfect', correct: false }]);
  });

  it('gives an onset to the nearest target and ignores extra strums', () => {
    const { scorer, strum } = setup();
    scorer.addTarget(target(1, em));
    scorer.addTarget(target(1.15, em));
    strum(1.0);
    strum(1.06); // nearer the first, already hit: an extra
    strum(1.13); // the second, 20 ms early
    scorer.update(10);
    expect(scorer.hits.map((hit) => [hit.timing, Math.round((hit.deviation ?? 0) * 1000)])).toEqual(
      [
        ['perfect', 0],
        ['perfect', -20],
      ],
    );
  });

  it('ignores onsets far from every target', () => {
    const { scorer, strum } = setup();
    scorer.addTarget(target(1, em));
    strum(0.5);
    scorer.update(10);
    expect(scorer.hits).toMatchObject([{ timing: 'miss' }]);
  });

  it('counts a chord as wrong when no chroma arrives in time', () => {
    const { scorer } = setup();
    scorer.addTarget(target(1, em));
    scorer.addOnset({ time: 1 + LATENCY, strength: 1 });
    scorer.update(1.2);
    expect(scorer.hits).toEqual([]);
    scorer.update(1.4);
    expect(scorer.hits).toMatchObject([{ timing: 'perfect', correct: false }]);
  });

  describe('single notes', () => {
    function playNote(scorer: Scorer, time: number, frequency: number) {
      const onsetTime = time + LATENCY;
      scorer.addOnset({ time: onsetTime, strength: 1 });
      for (let i = 0; i < 5; i++) {
        scorer.addPitch({ time: onsetTime + 0.06 + i * 0.01, frequency, clarity: 0.95, rms: 0.05 });
      }
    }

    it('accepts the note within ±50 cents and rejects others', () => {
      const scorer = new Scorer({ latency: LATENCY, a4: 440 });
      const g2 = midiToFrequency(43);
      [1, 2, 3].forEach((time) => {
        scorer.addTarget(target(time, { kind: 'note', midi: 43 }));
      });
      playNote(scorer, 1, g2 * 2 ** (40 / 1200));
      playNote(scorer, 2, g2 * 2 ** (60 / 1200));
      playNote(scorer, 3, midiToFrequency(55)); // an octave up
      scorer.update(10);
      expect(scorer.hits.map((hit) => hit.correct)).toEqual([true, false, false]);
    });

    it('uses the reference pitch', () => {
      const scorer = new Scorer({ latency: LATENCY, a4: 432 });
      scorer.addTarget(target(1, { kind: 'note', midi: 69 }));
      playNote(scorer, 1, 432);
      expect(scorer.hits).toMatchObject([{ correct: true }]);
    });

    it('ignores unclear pitch frames and the attack itself', () => {
      const scorer = new Scorer({ latency: LATENCY, a4: 440 });
      scorer.addTarget(target(1, { kind: 'note', midi: 40 }));
      const onsetTime = 1 + LATENCY;
      scorer.addOnset({ time: onsetTime, strength: 1 });
      scorer.addPitch({ time: onsetTime + 0.01, frequency: 300, clarity: 0.99, rms: 0.1 });
      for (let i = 0; i < 3; i++) {
        scorer.addPitch({
          time: onsetTime + 0.06 + i * 0.01,
          frequency: 300,
          clarity: 0.5,
          rms: 0.1,
        });
      }
      for (let i = 0; i < 3; i++) {
        scorer.addPitch({
          time: onsetTime + 0.1 + i * 0.01,
          frequency: midiToFrequency(40),
          clarity: 0.95,
          rms: 0.1,
        });
      }
      expect(scorer.hits).toMatchObject([{ correct: true }]);
    });
  });

  it('forgets cancelled targets instead of calling them missed', () => {
    const { scorer, strum } = setup();
    [1, 2, 3].forEach((time) => {
      scorer.addTarget(target(time, em));
    });
    strum(1);
    scorer.cancelFrom(1.8);
    scorer.update(10);
    expect(scorer.hits).toHaveLength(1);
  });

  it('measures accuracy per pass, from judged targets only', () => {
    const { scorer, strum } = setup();
    scorer.addTarget(target(1, em, { pass: 1 }));
    scorer.addTarget(target(2, em, { pass: 1 }));
    scorer.addTarget(target(3, em, { pass: 2 }));
    expect(scorer.passAccuracy(1)).toBeNull();
    strum(1);
    expect(scorer.passAccuracy(1)).toBe(1);
    strum(2.07); // good
    expect(scorer.passAccuracy(1)).toBeCloseTo((1 + 0.85) / 2, 9);
    expect(scorer.passAccuracy(2)).toBeNull();
  });

  it('settles everything at the end of a session', () => {
    const { scorer } = setup();
    scorer.addTarget(target(1, em));
    scorer.addTarget(target(2, em));
    scorer.addOnset({ time: 1 + LATENCY, strength: 1 });
    scorer.settleAll();
    expect(scorer.hits.map((hit) => [hit.timing, hit.correct])).toEqual([
      ['perfect', false],
      ['miss', false],
    ]);
  });
});
