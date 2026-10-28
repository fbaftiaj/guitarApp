// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionResult } from '@/storage/types';
import {
  METER_DECAY,
  STREAK_MIN_SECONDS,
  accuracyHistory,
  practiceMinutes,
  practiceStreak,
  skillMeters,
} from './stats';

const ENOUGH = STREAK_MIN_SECONDS;

function session(overrides: Partial<SessionResult> = {}): SessionResult {
  return {
    id: 'x',
    exerciseId: 'ex',
    lessonId: null,
    mode: 'practice',
    startedAt: 0,
    durationMs: 1000,
    bpm: 80,
    accuracy: 1,
    hits: { perfect: 16, good: 0, early: 0, late: 0, miss: 0 },
    skills: {},
    missed: {},
    ...overrides,
  };
}

describe('practiceStreak', () => {
  it('counts the days in a row up to today', () => {
    const days = { '2026-10-26': ENOUGH, '2026-10-27': ENOUGH, '2026-10-28': ENOUGH };
    expect(practiceStreak(days, '2026-10-28')).toEqual({
      current: 3,
      longest: 3,
      practisedToday: true,
    });
  });

  it('keeps the streak alive until today is over', () => {
    const days = { '2026-10-26': ENOUGH, '2026-10-27': ENOUGH };
    expect(practiceStreak(days, '2026-10-28')).toMatchObject({ current: 2, practisedToday: false });
    expect(practiceStreak(days, '2026-10-29').current).toBe(0);
  });

  it('needs a minute of playing for a day to count', () => {
    const days = { '2026-10-27': ENOUGH - 1, '2026-10-28': ENOUGH };
    expect(practiceStreak(days, '2026-10-28')).toMatchObject({ current: 1, longest: 1 });
  });

  it('remembers the longest run, across months', () => {
    const days = {
      '2026-09-29': ENOUGH,
      '2026-09-30': ENOUGH,
      '2026-10-01': ENOUGH,
      '2026-10-02': ENOUGH,
      '2026-10-27': ENOUGH,
    };
    expect(practiceStreak(days, '2026-10-28')).toEqual({
      current: 1,
      longest: 4,
      practisedToday: false,
    });
    expect(practiceStreak({}, '2026-10-28')).toEqual({
      current: 0,
      longest: 0,
      practisedToday: false,
    });
  });
});

describe('practiceMinutes', () => {
  it('totals whole minutes, and the last seven days', () => {
    const days = { '2026-10-01': 600, '2026-10-22': 90, '2026-10-28': 150 };
    expect(practiceMinutes(days, '2026-10-28')).toEqual({ total: 14, week: 4 });
  });
});

describe('accuracyHistory', () => {
  const dayOf = (time: number) => `2026-10-${String(time).padStart(2, '0')}`;

  it('averages each day over its strums and notes, oldest day first', () => {
    const history = accuracyHistory(
      [
        session({
          startedAt: 28,
          accuracy: 1,
          hits: { perfect: 30, good: 0, early: 0, late: 0, miss: 0 },
        }),
        session({
          startedAt: 28,
          accuracy: 0.5,
          hits: { perfect: 5, good: 0, early: 0, late: 0, miss: 5 },
        }),
        session({ startedAt: 26, accuracy: 0.8 }),
      ],
      '2026-10-28',
      dayOf,
      3,
    );
    expect(history).toEqual([
      { day: '2026-10-26', accuracy: 0.8, sessions: 1 },
      { day: '2026-10-27', accuracy: null, sessions: 0 },
      { day: '2026-10-28', accuracy: (30 + 5) / 40, sessions: 2 },
    ]);
  });

  it('covers thirty days by default', () => {
    const history = accuracyHistory([], '2026-10-28', dayOf);
    expect(history).toHaveLength(30);
    expect(history[0]?.day).toBe('2026-09-29');
  });
});

describe('skillMeters', () => {
  const target = (id: string) => (id === 'ex' ? 80 : undefined);

  it('shows unpractised skills as empty', () => {
    const meters = skillMeters([], target);
    expect(meters.map((meter) => meter.skill)).toEqual([
      'chords',
      'chordChanges',
      'rhythm',
      'strumming',
      'singleNotes',
      'lead',
      'theory',
    ]);
    expect(meters.every((meter) => meter.value === null && meter.sessions === 0)).toBe(true);
  });

  it('weights newer sessions more', () => {
    const meters = skillMeters(
      [
        session({ startedAt: 1, skills: { rhythm: 0.5 } }),
        session({ startedAt: 2, skills: { rhythm: 1 } }),
      ],
      target,
    );
    const rhythm = meters.find((meter) => meter.skill === 'rhythm');
    expect(rhythm?.sessions).toBe(2);
    expect(rhythm?.value).toBeCloseTo((1 + METER_DECAY * 0.5) / (1 + METER_DECAY), 9);
  });

  it('gives credit in proportion to the tempo played', () => {
    const [chords] = skillMeters([session({ bpm: 40, skills: { chords: 1 } })], target);
    expect(chords?.value).toBeCloseTo(0.5, 9);
    // Faster than the target earns no extra credit.
    const [fast] = skillMeters([session({ bpm: 120, skills: { chords: 0.9 } })], target);
    expect(fast?.value).toBeCloseTo(0.9, 9);
  });

  it('counts short sessions less', () => {
    const short = session({
      startedAt: 2,
      skills: { strumming: 0 },
      hits: { perfect: 4, good: 0, early: 0, late: 0, miss: 0 },
    });
    const full = session({ startedAt: 1, skills: { strumming: 1 } });
    const strumming = skillMeters([short, full], target).find((m) => m.skill === 'strumming');
    // Weights: 0.25 for the short newest session, 0.85 for the full one.
    expect(strumming?.value).toBeCloseTo(METER_DECAY / (0.25 + METER_DECAY), 9);
  });
});
