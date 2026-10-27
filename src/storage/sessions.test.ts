import { describe, expect, it } from 'vitest';
import { listSessions, listSessionsForExercise, saveSession } from './sessions';
import type { NewSessionResult } from './types';

function session(overrides: Partial<NewSessionResult> = {}): NewSessionResult {
  return {
    exerciseId: 'em-am-changes',
    lessonId: 'stage-2-unit-1-lesson-3',
    mode: 'practice',
    startedAt: 1_000,
    durationMs: 60_000,
    bpm: 80,
    accuracy: 0.9,
    hits: { perfect: 10, good: 5, early: 1, late: 1, miss: 1 },
    skills: { chords: 0.9, chordChanges: 0.8 },
    missed: { Am: 1 },
    ...overrides,
  };
}

describe('saveSession', () => {
  it('stores the session with a generated id', async () => {
    const saved = await saveSession(session());

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await listSessions()).toEqual([saved]);
  });

  it.each([
    ['accuracy above 1', { accuracy: 1.2 }],
    ['negative duration', { durationMs: -1 }],
    ['zero tempo', { bpm: 0 }],
    ['fractional hit count', { hits: { perfect: 1.5, good: 0, early: 0, late: 0, miss: 0 } }],
    ['skill score out of range', { skills: { rhythm: -0.1 } }],
    ['empty exercise id', { exerciseId: '' }],
  ])('rejects a result with %s and stores nothing', async (_case, overrides) => {
    await expect(saveSession(session(overrides))).rejects.toThrow();
    expect(await listSessions()).toEqual([]);
  });
});

describe('listSessions', () => {
  it('returns sessions newest first, filtered by start time and limited', async () => {
    const old = await saveSession(session({ startedAt: 1_000 }));
    const middle = await saveSession(session({ startedAt: 2_000 }));
    const latest = await saveSession(session({ startedAt: 3_000 }));

    expect(await listSessions()).toEqual([latest, middle, old]);
    expect(await listSessions({ since: 2_000 })).toEqual([latest, middle]);
    expect(await listSessions({ limit: 1 })).toEqual([latest]);
  });
});

describe('listSessionsForExercise', () => {
  it('returns only that exercise, newest first', async () => {
    const first = await saveSession(session({ exerciseId: 'riff-1', startedAt: 1_000 }));
    await saveSession(session({ exerciseId: 'other', startedAt: 1_500 }));
    const second = await saveSession(session({ exerciseId: 'riff-1', startedAt: 2_000 }));

    expect(await listSessionsForExercise('riff-1')).toEqual([second, first]);
  });
});
