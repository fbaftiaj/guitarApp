// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COURSE } from '@/content/course';
import { starsFor, STAR_THRESHOLDS } from '@/features/practice/scoring/stars';
import type { LessonProgress, StarCount } from '@/storage/types';
import { courseProgress, isStagePassed, lessonAfter, type ProgressByLesson } from './progression';

const [stage1, stage2, stage3, stage4] = COURSE.stages;
const ids = (stage: typeof stage1) => stage?.lessons.map((lesson) => lesson.id) ?? [];

function done(lessonIds: readonly string[], stars: StarCount = 2): ProgressByLesson {
  return Object.fromEntries(
    lessonIds.map((lessonId): [string, LessonProgress] => [
      lessonId,
      { lessonId, stars, bestAccuracy: 0.9, attempts: 1, completedAt: 1, updatedAt: 1 },
    ]),
  );
}

describe('star thresholds', () => {
  it.each([
    [0, 0],
    [0.699, 0],
    [0.7, 1],
    [0.849, 1],
    [0.85, 2],
    [0.949, 2],
    [0.95, 3],
    [1, 3],
  ])('gives %f accuracy %i stars', (accuracy, stars) => {
    expect(starsFor(accuracy)).toBe(stars);
  });

  it('passes at 70 %, 85 % and 95 %', () => {
    expect(STAR_THRESHOLDS).toEqual([0.7, 0.85, 0.95]);
  });
});

describe('courseProgress', () => {
  it('opens only the first lesson of a new course', () => {
    const { lessons, stages, next } = courseProgress(COURSE, {});
    const statuses = COURSE.lessons.map((lesson) => lessons.get(lesson.id)?.status);
    expect(statuses[0]).toBe('available');
    expect(statuses.slice(1).every((status) => status === 'locked')).toBe(true);
    expect(next?.id).toBe(COURSE.lessons[0]?.id);
    expect(stages.get(stage1?.id ?? '')?.status).toBe('available');
    expect(stages.get(stage2?.id ?? '')?.status).toBe('locked');
  });

  it('opens lessons one after another', () => {
    const [first, second, third] = ids(stage1);
    const { lessons, next } = courseProgress(COURSE, done([first ?? '']));
    expect(lessons.get(first ?? '')).toEqual({ status: 'completed', stars: 2 });
    expect(lessons.get(second ?? '')?.status).toBe('available');
    expect(lessons.get(third ?? '')?.status).toBe('locked');
    expect(next?.id).toBe(second);
  });

  it('does not open the next lesson after a failed check', () => {
    const [first, second] = ids(stage1);
    const { lessons } = courseProgress(COURSE, done([first ?? ''], 0));
    expect(lessons.get(first ?? '')?.status).toBe('available');
    expect(lessons.get(second ?? '')?.status).toBe('locked');
  });

  it('opens the next stage only once the previous stage is passed', () => {
    const allButLast = ids(stage1).slice(0, -1);
    let progress = courseProgress(COURSE, done(allButLast));
    expect(progress.lessons.get(ids(stage2)[0] ?? '')?.status).toBe('locked');
    expect(progress.next?.id).toBe(ids(stage1).at(-1));

    progress = courseProgress(COURSE, done(ids(stage1)));
    expect(progress.stages.get(stage1?.id ?? '')?.status).toBe('completed');
    expect(progress.stages.get(stage2?.id ?? '')?.status).toBe('available');
    expect(progress.lessons.get(ids(stage2)[0] ?? '')?.status).toBe('available');
    expect(progress.next?.id).toBe(ids(stage2)[0]);
  });

  it('counts completed lessons and stars per stage', () => {
    const progress = courseProgress(COURSE, {
      ...done(ids(stage1).slice(0, 2), 3),
      ...done(ids(stage1).slice(2, 3), 1),
    });
    expect(progress.stages.get(stage1?.id ?? '')).toEqual({
      status: 'available',
      completedLessons: 3,
      totalLessons: 15,
      stars: 7,
      maxStars: 45,
    });
  });

  it('keeps preview stages closed, even after every playable stage is passed', () => {
    const progress = courseProgress(COURSE, done([...ids(stage1), ...ids(stage2), ...ids(stage3)]));
    expect(progress.stages.get(stage4?.id ?? '')?.status).toBe('preview');
    expect(progress.next).toBeNull();
  });

  it('keeps a completed lesson open even if an earlier one is not', () => {
    const [, second, third] = ids(stage1);
    const { lessons, next } = courseProgress(COURSE, done([second ?? '']));
    expect(lessons.get(second ?? '')?.status).toBe('completed');
    expect(lessons.get(third ?? '')?.status).toBe('available');
    expect(next?.id).toBe(ids(stage1)[0]);
  });
});

describe('isStagePassed', () => {
  it('needs every lesson completed', () => {
    if (!stage1 || !stage4) throw new Error('missing stages');
    expect(isStagePassed(stage1, done(ids(stage1).slice(1)))).toBe(false);
    expect(isStagePassed(stage1, done(ids(stage1)))).toBe(true);
    expect(isStagePassed(stage4, {})).toBe(false);
  });
});

describe('lessonAfter', () => {
  it('moves on in course order, across stages', () => {
    expect(lessonAfter(COURSE, ids(stage1)[0] ?? '')?.id).toBe(ids(stage1)[1]);
    expect(lessonAfter(COURSE, ids(stage1).at(-1) ?? '')?.id).toBe(ids(stage2)[0]);
    expect(lessonAfter(COURSE, ids(stage3).at(-1) ?? '')).toBeNull();
    expect(lessonAfter(COURSE, 'nope')).toBeNull();
  });
});
