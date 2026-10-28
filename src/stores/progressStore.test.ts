import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lessonProgress from '@/storage/lessonProgress';
import { useProgressStore } from './progressStore';

describe('useProgressStore', () => {
  beforeEach(() => {
    useProgressStore.setState({ lessons: {}, status: 'idle' });
    vi.restoreAllMocks();
  });

  it('loads saved progress', async () => {
    await lessonProgress.recordLessonAttempt('a', { accuracy: 0.9, stars: 2, at: 1 });

    await useProgressStore.getState().load();

    expect(useProgressStore.getState()).toMatchObject({
      status: 'ready',
      lessons: { a: { stars: 2, bestAccuracy: 0.9 } },
    });
  });

  it('records attempts in storage and in the store', async () => {
    await useProgressStore.getState().load();

    const progress = await useProgressStore
      .getState()
      .recordAttempt('a', { accuracy: 0.75, stars: 1, at: 5 });

    expect(progress).toMatchObject({ stars: 1, attempts: 1, completedAt: 5 });
    expect(useProgressStore.getState().lessons.a).toEqual(progress);
    expect(await lessonProgress.getLessonProgress('a')).toEqual(progress);
  });

  it('keeps results recorded while the saved progress was loading', async () => {
    await lessonProgress.recordLessonAttempt('a', { accuracy: 0.8, stars: 1, at: 1 });
    const recorded = {
      lessonId: 'a',
      stars: 3,
      bestAccuracy: 1,
      attempts: 2,
      completedAt: 1,
      updatedAt: 2,
    } as const;
    useProgressStore.setState({ lessons: { a: recorded } });

    await useProgressStore.getState().load();

    expect(useProgressStore.getState().lessons).toEqual({ a: recorded });
  });

  it('carries on in memory when storage fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(lessonProgress, 'listLessonProgress').mockRejectedValue(new Error('blocked'));
    vi.spyOn(lessonProgress, 'recordLessonAttempt').mockRejectedValue(new Error('blocked'));

    await useProgressStore.getState().load();
    const store = useProgressStore.getState();
    await store.recordAttempt('a', { accuracy: 0.6, stars: 0, at: 1 });
    const progress = await store.recordAttempt('a', { accuracy: 0.9, stars: 2, at: 2 });

    expect(progress).toMatchObject({ stars: 2, attempts: 2, completedAt: 2 });
    expect(useProgressStore.getState()).toMatchObject({
      status: 'unavailable',
      lessons: { a: progress },
    });
  });
});
