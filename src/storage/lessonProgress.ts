import { getDB } from './db';
import {
  lessonAttemptSchema,
  lessonProgressSchema,
  type LessonAttempt,
  type LessonProgress,
} from './types';

/**
 * Records one lesson check attempt, keeping the best stars and accuracy.
 * Read and write happen in a single transaction so concurrent attempts
 * cannot lose an update.
 */
export async function recordLessonAttempt(
  lessonId: string,
  attempt: LessonAttempt,
): Promise<LessonProgress> {
  const { accuracy, stars, at } = lessonAttemptSchema.parse(attempt);
  const db = await getDB();
  const tx = db.transaction('lessonProgress', 'readwrite');
  const previous = await tx.store.get(lessonId);
  const next = lessonProgressSchema.parse({
    lessonId,
    stars: Math.max(previous?.stars ?? 0, stars),
    bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, accuracy),
    attempts: (previous?.attempts ?? 0) + 1,
    completedAt: previous?.completedAt ?? (stars > 0 ? at : null),
    updatedAt: at,
  });
  await Promise.all([tx.store.put(next), tx.done]);
  return next;
}

export async function getLessonProgress(lessonId: string): Promise<LessonProgress | undefined> {
  const db = await getDB();
  return db.get('lessonProgress', lessonId);
}

export async function listLessonProgress(): Promise<LessonProgress[]> {
  const db = await getDB();
  return db.getAll('lessonProgress');
}
