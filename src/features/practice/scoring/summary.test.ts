// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findExercise, type Exercise } from '@/content/exercises';
import type { Hit } from './scorer';
import { sessionRecord, suggestion, summarize, summarizeWait } from './summary';
import type { Timing } from './timing';

function exercise(id: string): Exercise {
  const found = findExercise(id);
  if (!found) throw new Error(`missing exercise ${id}`);
  return found;
}

function hit(
  time: number,
  timing: Timing,
  correct: boolean,
  { label = 'Em', change = false, deviation = 0 } = {},
): Hit {
  return {
    target: {
      id: time,
      index: 0,
      pass: 1,
      time,
      expected: { kind: 'chord', chordId: label, direction: 'down' },
      label,
      change,
    },
    timing,
    deviation: timing === 'miss' ? null : deviation,
    correct: timing === 'miss' ? false : correct,
    final: true,
  };
}

describe('summarize', () => {
  const em = exercise('em-am-changes');

  it('scores accuracy, stars, counts and the most missed chords', () => {
    const hits = [
      hit(10, 'perfect', true, { deviation: 0.01 }),
      hit(10.5, 'good', true, { deviation: 0.06 }),
      hit(11, 'late', true, { deviation: 0.15 }),
      hit(11.5, 'perfect', false, { label: 'Am', deviation: -0.01 }),
      hit(12, 'miss', false, { label: 'Am' }),
      hit(12.5, 'miss', false),
    ];
    const summary = summarize(hits, { exercise: em, tempo: 60, startTime: 10 });

    expect(summary.accuracy).toBeCloseTo((1 + 0.85 + 0.5) / 6, 9);
    expect(summary.stars).toBe(0);
    expect(summary.counts).toEqual({ perfect: 2, good: 1, early: 0, late: 1, miss: 2 });
    expect(summary.wrong).toBe(1);
    expect(summary.total).toBe(6);
    expect(summary.mostMissed).toEqual([
      { label: 'Am', count: 2 },
      { label: 'Em', count: 1 },
    ]);
    expect(summary.meanDeviationMs).toBe(53);
    expect(summary.timeline[1]).toMatchObject({ time: 0.5, timing: 'good', correct: true });
    expect(summary.timeline[1]?.deviationMs).toBeCloseTo(60, 9);
  });

  it('scores only the skills the exercise trains', () => {
    const hits = [
      hit(0, 'perfect', true, { change: true }),
      hit(1, 'good', false),
      hit(2, 'miss', false),
    ];
    const summary = summarize(hits, { exercise: em, tempo: 60, startTime: 0 });
    expect(Object.keys(summary.skills).sort()).toEqual(['chordChanges', 'chords', 'rhythm']);
    expect(summary.skills.rhythm).toBeCloseTo((1 + 0.85) / 3, 9);
    expect(summary.skills.chords).toBe(0.5);
    expect(summary.skills.chordChanges).toBe(1);
  });

  it('handles an empty session', () => {
    const summary = summarize([], { exercise: em, tempo: 60, startTime: 0 });
    expect(summary).toMatchObject({ accuracy: 0, stars: 0, total: 0, meanDeviationMs: null });
  });
});

describe('summarizeWait', () => {
  it('scores right-first-time chords', () => {
    const summary = summarizeWait(
      { targets: 8, firstTry: 6 },
      {
        exercise: exercise('em-am-changes'),
        tempo: 60,
      },
    );
    expect(summary).toMatchObject({ accuracy: 0.75, stars: 1, total: 8, skills: { chords: 0.75 } });
    expect(summary.counts).toEqual({ perfect: 0, good: 6, early: 0, late: 0, miss: 2 });
  });
});

describe('sessionRecord', () => {
  it('builds a valid session record', async () => {
    const { sessionResultSchema } = await import('@/storage/types');
    const em = exercise('em-am-changes');
    const summary = summarize([hit(0, 'perfect', true), hit(1, 'miss', false, { label: 'Am' })], {
      exercise: em,
      tempo: 64,
      startTime: 0,
    });
    const record = sessionRecord(summary, {
      exercise: em,
      tempo: 64,
      startedAt: 1_700_000_000_000.4,
      durationMs: 12_345.6,
    });
    expect(record).toMatchObject({
      exerciseId: 'em-am-changes',
      mode: 'practice',
      bpm: 64,
      accuracy: 0.5,
      missed: { Am: 1 },
      durationMs: 12_346,
    });
    expect(sessionResultSchema.safeParse({ ...record, id: 'x' }).success).toBe(true);
  });
});

describe('suggestion', () => {
  it.each([
    [0.5, 80, 80, 'slower', 70],
    [0.69, 50, 80, 'slower', 45],
    [0.1, 32, 80, 'slower', 30],
    [0.75, 60, 80, 'again', 60],
    [0.9, 60, 80, 'faster', 70],
    [0.9, 76, 80, 'faster', 80],
    [0.9, 80, 80, 'next', null],
    [1, 100, 80, 'next', null],
  ])('at %f accuracy, %i BPM (target %i): %s', (accuracy, tempo, target, kind, next) => {
    expect(suggestion(accuracy, tempo, target)).toMatchObject({ kind, tempo: next });
  });

  it('words the advice', () => {
    expect(suggestion(0.5, 80, 80).text).toBe('Try again at 70 BPM');
    expect(suggestion(0.9, 80, 80).text).toBe('Ready for the next lesson');
  });
});
