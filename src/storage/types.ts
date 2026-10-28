import { z } from 'zod/mini';

/**
 * Records persisted in IndexedDB. Each schema validates on write, so a bug in
 * a producer (e.g. an accuracy of 1.2) fails loudly instead of corrupting the
 * skill profile that is computed from these records.
 */

const unitInterval = z.number().check(z.gte(0), z.lte(1));
const count = z.int().check(z.nonnegative());
const timestamp = z.int().check(z.nonnegative());
const id = z.string().check(z.minLength(1));

/** Skills shown as meters on the profile screen. */
export const skillIdSchema = z.enum([
  'chords',
  'chordChanges',
  'rhythm',
  'strumming',
  'singleNotes',
  'lead',
  'theory',
]);
export type SkillId = z.infer<typeof skillIdSchema>;

export const starCountSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type StarCount = z.infer<typeof starCountSchema>;

/** One scored run of an exercise (practice, lesson check or stage test). */
export const sessionResultSchema = z.object({
  id,
  exerciseId: id,
  lessonId: z.nullable(id),
  mode: z.enum(['practice', 'check', 'stageTest']),
  /** Epoch milliseconds. */
  startedAt: timestamp,
  durationMs: z.number().check(z.nonnegative()),
  bpm: z.number().check(z.positive()),
  /** 0–1 score: right chords or notes earn full credit when Perfect, less when Good, Early or Late. */
  accuracy: unitInterval,
  hits: z.object({ perfect: count, good: count, early: count, late: count, miss: count }),
  /** 0–1 score per skill this exercise trains. */
  skills: z.partialRecord(skillIdSchema, unitInterval),
  /** Miss count per target label (chord or note name), for "most missed" stats. */
  missed: z.record(z.string(), count),
});
export type SessionResult = z.infer<typeof sessionResultSchema>;
export type NewSessionResult = Omit<SessionResult, 'id'>;

/** Best result per lesson. A lesson counts as completed once it has earned a star. */
export const lessonProgressSchema = z.object({
  lessonId: id,
  stars: starCountSchema,
  bestAccuracy: unitInterval,
  attempts: count,
  /** When the lesson was first passed (earned ≥ 1 star), or null. */
  completedAt: z.nullable(timestamp),
  updatedAt: timestamp,
});
export type LessonProgress = z.infer<typeof lessonProgressSchema>;

export const lessonAttemptSchema = z.object({
  accuracy: unitInterval,
  stars: starCountSchema,
  at: timestamp,
});
export type LessonAttempt = z.infer<typeof lessonAttemptSchema>;
