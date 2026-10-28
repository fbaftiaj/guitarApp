import { addDays } from '@/lib/time/localDay';
import type { SessionResult, SkillId } from '@/storage/types';

/**
 * Profile statistics, all pure: streaks and minutes come from the time spent
 * playing per day, accuracy history and skill meters from scored sessions.
 */

/** A day counts towards the streak after this much playing. */
export const STREAK_MIN_SECONDS = 60;

export interface Streak {
  /** Days in a row up to today, or up to yesterday if today has no practice yet. */
  current: number;
  longest: number;
  practisedToday: boolean;
}

export type SecondsByDay = Readonly<Partial<Record<string, number>>>;

const counts = (days: SecondsByDay, day: string) => (days[day] ?? 0) >= STREAK_MIN_SECONDS;

export function practiceStreak(days: SecondsByDay, today: string): Streak {
  const practisedToday = counts(days, today);
  let current = 0;
  for (let day = practisedToday ? today : addDays(today, -1); counts(days, day);) {
    current++;
    day = addDays(day, -1);
  }

  let longest = 0;
  for (const day of Object.keys(days).sort()) {
    if (!counts(days, day) || counts(days, addDays(day, -1))) continue;
    // `day` starts a run: follow it.
    let length = 0;
    for (let next = day; counts(days, next); next = addDays(next, 1)) length++;
    longest = Math.max(longest, length);
  }
  return { current, longest: Math.max(longest, current), practisedToday };
}

/** Whole minutes played, in total and over the last seven days (today included). */
export function practiceMinutes(
  days: SecondsByDay,
  today: string,
): { total: number; week: number } {
  const total = Object.values(days).reduce<number>((sum, seconds) => sum + (seconds ?? 0), 0);
  let week = 0;
  for (let i = 0; i < 7; i++) week += days[addDays(today, -i)] ?? 0;
  return { total: Math.floor(total / 60), week: Math.floor(week / 60) };
}

export interface DayAccuracy {
  day: string;
  /** 0–1 over every strum or note scored that day, or null without sessions. */
  accuracy: number | null;
  sessions: number;
}

const targetsOf = (session: SessionResult) =>
  Object.values(session.hits).reduce((sum, count) => sum + count, 0);

/** Daily accuracy for the `length` days up to `today`, oldest first. */
export function accuracyHistory(
  sessions: readonly SessionResult[],
  today: string,
  dayOf: (time: number) => string,
  length = 30,
): DayAccuracy[] {
  const totals = new Map<string, { credit: number; targets: number; sessions: number }>();
  for (const session of sessions) {
    const day = dayOf(session.startedAt);
    const targets = Math.max(1, targetsOf(session));
    const total = totals.get(day) ?? { credit: 0, targets: 0, sessions: 0 };
    total.credit += session.accuracy * targets;
    total.targets += targets;
    total.sessions++;
    totals.set(day, total);
  }
  return Array.from({ length }, (_, i) => {
    const day = addDays(today, i - length + 1);
    const total = totals.get(day);
    return {
      day,
      accuracy: total ? total.credit / total.targets : null,
      sessions: total?.sessions ?? 0,
    };
  });
}

/** Skill meters, in the order the profile shows them. */
export const SKILLS: readonly SkillId[] = [
  'chords',
  'chordChanges',
  'rhythm',
  'strumming',
  'singleNotes',
  'lead',
  'theory',
];

/** Sessions a meter looks back over, and how much less each older one counts. */
export const METER_SESSIONS = 20;
export const METER_DECAY = 0.85;
/** Sessions with fewer targets than this count proportionally less. */
const FULL_WEIGHT_TARGETS = 16;

export interface SkillMeter {
  skill: SkillId;
  /** 0–1, or null when the skill has not been practised. */
  value: number | null;
  sessions: number;
}

/**
 * Each meter averages the skill's score over its recent sessions, newer ones
 * counting more. A score played below the exercise's target tempo counts in
 * proportion (half speed, half credit), so meters reflect real playing, not
 * just finished lessons.
 */
export function skillMeters(
  sessions: readonly SessionResult[],
  targetTempo: (exerciseId: string) => number | undefined,
): SkillMeter[] {
  const newestFirst = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  return SKILLS.map((skill) => {
    const scored = newestFirst
      .filter((session) => session.skills[skill] !== undefined)
      .slice(0, METER_SESSIONS);
    let sum = 0;
    let weights = 0;
    scored.forEach((session, i) => {
      const target = targetTempo(session.exerciseId);
      const speed = target ? Math.min(1, session.bpm / target) : 1;
      const weight = METER_DECAY ** i * Math.min(1, targetsOf(session) / FULL_WEIGHT_TARGETS);
      sum += weight * (session.skills[skill] ?? 0) * speed;
      weights += weight;
    });
    return { skill, value: weights > 0 ? sum / weights : null, sessions: scored.length };
  });
}
