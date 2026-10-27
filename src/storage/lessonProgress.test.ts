import { describe, expect, it } from 'vitest';
import { getLessonProgress, listLessonProgress, recordLessonAttempt } from './lessonProgress';

const LESSON = 'stage-1-unit-1-lesson-1';

describe('recordLessonAttempt', () => {
  it('creates progress on the first attempt', async () => {
    const progress = await recordLessonAttempt(LESSON, { accuracy: 0.8, stars: 1, at: 1_000 });

    expect(progress).toEqual({
      lessonId: LESSON,
      stars: 1,
      bestAccuracy: 0.8,
      attempts: 1,
      completedAt: 1_000,
      updatedAt: 1_000,
    });
    expect(await getLessonProgress(LESSON)).toEqual(progress);
  });

  it('keeps the best stars and accuracy, and the first completion time', async () => {
    await recordLessonAttempt(LESSON, { accuracy: 0.96, stars: 3, at: 1_000 });
    const progress = await recordLessonAttempt(LESSON, { accuracy: 0.72, stars: 1, at: 2_000 });

    expect(progress).toMatchObject({
      stars: 3,
      bestAccuracy: 0.96,
      attempts: 2,
      completedAt: 1_000,
      updatedAt: 2_000,
    });
  });

  it('does not complete a lesson until it earns a star', async () => {
    const failed = await recordLessonAttempt(LESSON, { accuracy: 0.5, stars: 0, at: 1_000 });
    expect(failed.completedAt).toBeNull();

    const passed = await recordLessonAttempt(LESSON, { accuracy: 0.86, stars: 2, at: 2_000 });
    expect(passed.completedAt).toBe(2_000);
  });

  it.each([
    ['accuracy above 1', { accuracy: 1.5, stars: 3 as const, at: 1 }],
    ['negative timestamp', { accuracy: 0.5, stars: 1 as const, at: -1 }],
  ])('rejects an attempt with %s', async (_case, attempt) => {
    await expect(recordLessonAttempt(LESSON, attempt)).rejects.toThrow();
    expect(await getLessonProgress(LESSON)).toBeUndefined();
  });
});

describe('listLessonProgress', () => {
  it('returns progress for every attempted lesson', async () => {
    await recordLessonAttempt('a', { accuracy: 0.9, stars: 2, at: 1 });
    await recordLessonAttempt('b', { accuracy: 0.4, stars: 0, at: 2 });

    const ids = (await listLessonProgress()).map((progress) => progress.lessonId);
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});
