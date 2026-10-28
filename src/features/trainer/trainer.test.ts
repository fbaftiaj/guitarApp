// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { StreamingChroma, type ChromaEvent } from '@/audio/dsp/chroma';
import { CHORDS } from '@/content/chords';
import { midiToFrequency } from '@/lib/music/notes';
import { mix, strum } from '@/test/guitarSignals';
import { QUIET_SECONDS, TrainerJudge, type Judgement } from './trainerJudge';
import { STRUMS_PER_CHORD, nextChordAfter, trainerPlan } from './trainerPlan';
import { feedbackText, instruction } from './trainerText';
import {
  INITIAL_TRAINER_STATE,
  isFinished,
  trainerReducer,
  type TrainerEvent,
} from './trainerState';

const RATE = 48_000;

function chromaOf(chordId: string, onsetTime: number): ChromaEvent {
  const midis = CHORDS.get(chordId)?.midis ?? [];
  const signal = mix(RATE, 1, [{ time: 0.3, signal: strum({ midis, sampleRate: RATE }) }], {
    noise: 0.002,
  });
  const analysis = new StreamingChroma(RATE);
  analysis.capture(0.3);
  const events: ChromaEvent[] = [];
  for (let i = 0; i < signal.length; i += 128) {
    analysis.push(signal.subarray(i, i + 128), i / RATE, (event) => events.push(event));
  }
  return { onsetTime, chroma: events[0]?.chroma ?? [] };
}

const frame = (time: number, midi: number) => ({
  time,
  frequency: midiToFrequency(midi),
  clarity: 0.97,
  rms: 0.05,
});

describe('trainerPlan', () => {
  it('learns a chord string by string from the lowest sounding string, then strums it', () => {
    const plan = trainerPlan({ chords: ['Am'], learn: true });
    expect(plan.map((step) => (step.kind === 'string' ? step.string : step.kind))).toEqual([
      5,
      4,
      3,
      2,
      1,
      'strum',
    ]);
    expect(plan[0]).toEqual({ kind: 'string', chordId: 'Am', string: 5, midi: 45 });
    expect(plan.at(-1)).toEqual({ kind: 'strum', chordId: 'Am', needed: STRUMS_PER_CHORD });
  });

  it('adds changes that alternate between two or more chords', () => {
    const plan = trainerPlan({ chords: ['G', 'C', 'D'], learn: false, changes: 5 });
    expect(plan.map((step) => step.chordId)).toEqual(['G', 'C', 'D', 'G', 'C']);
    expect(plan.every((step) => step.kind === 'change')).toBe(true);
    expect(nextChordAfter(plan, 0)).toBe('C');
    expect(nextChordAfter(plan, 4)).toBeNull();
  });

  it('skips unknown chords and has no changes for a single chord', () => {
    expect(trainerPlan({ chords: ['Em', 'Hm'], learn: false })).toEqual([]);
    expect(trainerPlan({ chords: ['Em'], learn: true }).every((s) => s.kind !== 'change')).toBe(
      true,
    );
  });
});

describe('trainerReducer', () => {
  const plan = trainerPlan({ chords: ['Em', 'Am'], learn: false, changes: 3 });
  const run = (...events: TrainerEvent[]) =>
    events.reduce((state, event) => trainerReducer(plan, state, event), INITIAL_TRAINER_STATE);
  const right = (at: number): TrainerEvent => ({ type: 'heard', correct: true, heard: null, at });

  it('moves on only when the chord is right, counting mistakes', () => {
    const state = run(
      { type: 'heard', correct: false, heard: { kind: 'chord', chordId: 'E' }, at: 1 },
      right(2),
    );
    expect(state).toMatchObject({ step: 1, mistakes: 1, attempts: 2 });
    // The feedback belongs to the chord just played, not the next one.
    expect(state.feedback).toEqual({ correct: true, heard: null, step: plan[0], attempt: 2 });
  });

  it('times each change after the first', () => {
    const state = run(right(1), right(3.5), right(4.5));
    expect(isFinished(plan, state)).toBe(true);
    expect(state.changeSeconds).toEqual([2.5, 1]);
  });

  it('needs three right strums on a strum step', () => {
    const learn = trainerPlan({ chords: ['Em'], learn: true });
    const strumStep = learn.findIndex((step) => step.kind === 'strum');
    let state = { ...INITIAL_TRAINER_STATE, step: strumStep };
    state = trainerReducer(learn, state, right(1));
    state = trainerReducer(learn, state, right(2));
    expect(state).toMatchObject({ step: strumStep, strums: 2 });
    state = trainerReducer(learn, state, right(3));
    expect(isFinished(learn, state)).toBe(true);
  });

  it('skips a step and restarts', () => {
    expect(run({ type: 'skip' }).step).toBe(1);
    expect(run(right(1), { type: 'restart' })).toEqual(INITIAL_TRAINER_STATE);
  });
});

describe('TrainerJudge', () => {
  function judge() {
    const judgements: Judgement[] = [];
    const instance = new TrainerJudge(440, (judgement) => judgements.push(judgement));
    return { instance, judgements };
  }

  it('accepts the right string by its pitch', () => {
    const { instance, judgements } = judge();
    instance.listenFor({ kind: 'note', midi: 50 });
    instance.onset({ time: 1, strength: 1 });
    for (let t = 1.06; t < 1.1; t += 0.01) instance.pitch(frame(t, 50));
    expect(judgements).toEqual([{ correct: true, heard: { kind: 'note', midi: 50 }, time: 1 }]);
  });

  it('names the note it heard instead', () => {
    const { instance, judgements } = judge();
    instance.listenFor({ kind: 'note', midi: 50 });
    instance.onset({ time: 1, strength: 1 });
    for (let t = 1.06; t < 1.1; t += 0.01) instance.pitch(frame(t, 45));
    expect(judgements).toEqual([{ correct: false, heard: { kind: 'note', midi: 45 }, time: 1 }]);
  });

  it('ignores an onset with no clear pitch, and the ringing right after a judgement', () => {
    const { instance, judgements } = judge();
    instance.listenFor({ kind: 'note', midi: 50 });
    instance.onset({ time: 1, strength: 1 });
    instance.pitch({ time: 1.4, frequency: 0, clarity: 0, rms: 0 });
    expect(judgements).toEqual([]);

    instance.onset({ time: 2, strength: 1 });
    for (let t = 2.06; t < 2.1; t += 0.01) instance.pitch(frame(t, 50));
    instance.onset({ time: 2 + QUIET_SECONDS / 2, strength: 1 });
    for (let t = 2.2; t < 2.3; t += 0.01) instance.pitch(frame(t, 45));
    expect(judgements).toHaveLength(1);
  });

  it('judges chords by their chroma, naming the chord heard instead', () => {
    const { instance, judgements } = judge();
    instance.listenFor({ kind: 'chord', chordId: 'Em' });
    instance.onset({ time: 1, strength: 1 });
    instance.chroma(chromaOf('Em', 1));
    instance.onset({ time: 2, strength: 1 });
    instance.chroma(chromaOf('E', 2));
    expect(judgements).toEqual([
      { correct: true, heard: { kind: 'chord', chordId: 'Em' }, time: 1 },
      { correct: false, heard: { kind: 'chord', chordId: 'E' }, time: 2 },
    ]);
  });

  it('listens for nothing until given a target', () => {
    const { instance, judgements } = judge();
    instance.onset({ time: 1, strength: 1 });
    instance.chroma(chromaOf('Em', 1));
    expect(judgements).toEqual([]);
  });
});

describe('trainer text', () => {
  const [low, fretted] = trainerPlan({ chords: ['Am'], learn: true });

  it('says which string to play and how', () => {
    if (!low || !fretted) throw new Error('missing steps');
    expect(instruction(low)).toEqual({
      title: 'Play string 5 (A)',
      detail: 'Open: let it ring without touching it.',
    });
    expect(instruction(fretted)).toEqual({
      title: 'Play string 4 (D)',
      detail: 'Finger 2 on fret 2. Pick just this string.',
    });
    expect(instruction({ kind: 'change', chordId: 'G' }).title).toBe('Play G major');
  });

  it('explains a wrong string, a wrong chord and an unclear sound', () => {
    if (!fretted) throw new Error('missing step');
    const wrongString = {
      correct: false,
      heard: { kind: 'note', midi: 45 },
      step: fretted,
      attempt: 1,
    } as const;
    expect(feedbackText(wrongString)).toBe('That was A, string 5 (A). Now pick string 4 (D).');
    const offNote = { ...wrongString, heard: { kind: 'note', midi: 51 } } as const;
    expect(feedbackText(offNote)).toMatch(/^That was D♯/);
    const change = { kind: 'change', chordId: 'Em' } as const;
    const attempt = { step: change, attempt: 1 };
    expect(
      feedbackText({ correct: false, heard: { kind: 'chord', chordId: 'E' }, ...attempt }),
    ).toBe('That sounded like E major. Check each finger and try again.');
    expect(feedbackText({ correct: false, heard: null, ...attempt })).toMatch(/^That wasn’t clear/);
    expect(feedbackText({ correct: true, heard: null, ...attempt })).toBe('Yes! That’s E minor.');
  });
});
