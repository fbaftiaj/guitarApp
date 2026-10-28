// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COURSE } from '@/content/course';
import { STAR_THRESHOLDS, starsFor } from '@/features/practice/scoring/stars';
import type { LessonProgress, StarCount } from '@/storage/types';
import {
  LEVELS,
  courseProgress,
  isStagePassed,
  lessonAfter,
  levelFor,
  type NextStep,
  type ProgressByLesson,
} from './progression';

const [stage1, stage2, stage3, stage4] = COURSE.stages;
const ids = (stage: typeof stage1) => stage?.lessons.map((lesson) => lesson.id) ?? [];
const testId = (stage: typeof stage1) => stage?.test?.id ?? '';

function done(lessonIds: readonly string[], stars: StarCount = 2): ProgressByLesson {
  return Object.fromEntries(
    lessonIds.map((lessonId): [string, LessonProgress] => [
      lessonId,
      { lessonId, stars, bestAccuracy: 0.9, attempts: 1, completedAt: 1, updatedAt: 1 },
    ]),
  );
}

/** Every lesson of the stages, and their tests too if `tests`. */
function stagesDone(stages: readonly (typeof stage1)[], tests = true): ProgressByLesson {
  return done(stages.flatMap((stage) => [...ids(stage), ...(tests ? [testId(stage)] : [])]));
}

const nextId = (step: NextStep | null) =>
  step?.kind === 'lesson' ? step.lesson.id : step?.kind === 'test' ? step.test.id : null;

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
    const { lessons, stages, next, level } = courseProgress(COURSE, {});
    const statuses = COURSE.lessons.map((lesson) => lessons.get(lesson.id)?.status);
    expect(statuses[0]).toBe('available');
    expect(statuses.slice(1).every((status) => status === 'locked')).toBe(true);
    expect(nextId(next)).toBe(COURSE.lessons[0]?.id);
    expect(stages.get(stage1?.id ?? '')).toMatchObject({
      status: 'available',
      test: { status: 'locked', stars: 0 },
    });
    expect(stages.get(stage2?.id ?? '')?.status).toBe('locked');
    expect(level).toEqual({
      index: 0,
      name: 'Beginner 1',
      next: { name: 'Beginner 2', testsNeeded: 1 },
    });
  });

  it('opens lessons one after another', () => {
    const [first, second, third] = ids(stage1);
    const { lessons, next } = courseProgress(COURSE, done([first ?? '']));
    expect(lessons.get(first ?? '')).toEqual({ status: 'completed', stars: 2 });
    expect(lessons.get(second ?? '')?.status).toBe('available');
    expect(lessons.get(third ?? '')?.status).toBe('locked');
    expect(nextId(next)).toBe(second);
  });

  it('does not open the next lesson after a failed check', () => {
    const [first, second] = ids(stage1);
    const { lessons } = courseProgress(COURSE, done([first ?? ''], 0));
    expect(lessons.get(first ?? '')?.status).toBe('available');
    expect(lessons.get(second ?? '')?.status).toBe('locked');
  });

  it('opens the stage test once every lesson of the stage is completed', () => {
    let progress = courseProgress(COURSE, done(ids(stage1).slice(0, -1)));
    expect(progress.stages.get(stage1?.id ?? '')?.test?.status).toBe('locked');

    progress = courseProgress(COURSE, stagesDone([stage1], false));
    expect(progress.stages.get(stage1?.id ?? '')).toMatchObject({
      status: 'available',
      test: { status: 'available' },
    });
    expect(progress.next).toMatchObject({ kind: 'test', stage: { id: stage1?.id } });
    // Completing the lessons alone does not open the next stage.
    expect(progress.lessons.get(ids(stage2)[0] ?? '')?.status).toBe('locked');
    expect(progress.stages.get(stage2?.id ?? '')?.status).toBe('locked');
  });

  it('opens the next stage and raises the level once the stage test is passed', () => {
    const failed = courseProgress(COURSE, {
      ...stagesDone([stage1], false),
      ...done([testId(stage1)], 0),
    });
    expect(failed.stages.get(stage1?.id ?? '')?.test).toEqual({ status: 'available', stars: 0 });
    expect(failed.stagesPassed).toBe(0);

    const passed = courseProgress(COURSE, stagesDone([stage1]));
    expect(passed.stages.get(stage1?.id ?? '')).toMatchObject({
      status: 'completed',
      test: { status: 'passed', stars: 2 },
    });
    expect(passed.stages.get(stage2?.id ?? '')?.status).toBe('available');
    expect(passed.lessons.get(ids(stage2)[0] ?? '')?.status).toBe('available');
    expect(nextId(passed.next)).toBe(ids(stage2)[0]);
    expect(passed.stagesPassed).toBe(1);
    expect(passed.level.name).toBe('Beginner 2');
  });

  it('counts completed lessons and stars per stage', () => {
    const progress = courseProgress(COURSE, {
      ...done(ids(stage1).slice(0, 2), 3),
      ...done(ids(stage1).slice(2, 3), 1),
    });
    expect(progress.stages.get(stage1?.id ?? '')).toMatchObject({
      status: 'available',
      completedLessons: 3,
      totalLessons: 15,
      stars: 7,
      maxStars: 45,
    });
  });

  it('keeps preview stages closed, even after every playable stage is passed', () => {
    const progress = courseProgress(COURSE, stagesDone([stage1, stage2, stage3]));
    expect(progress.stages.get(stage4?.id ?? '')).toMatchObject({ status: 'preview', test: null });
    expect(progress.next).toBeNull();
    expect(progress.level.name).toBe('Intermediate 1');
  });

  it('keeps a completed lesson open even if an earlier one is not', () => {
    const [, second, third] = ids(stage1);
    const { lessons, next } = courseProgress(COURSE, done([second ?? '']));
    expect(lessons.get(second ?? '')?.status).toBe('completed');
    expect(lessons.get(third ?? '')?.status).toBe('available');
    expect(nextId(next)).toBe(ids(stage1)[0]);
  });
});

describe('starting at a later stage', () => {
  it('credits the earlier stages and carries on from the chosen one', () => {
    const progress = courseProgress(COURSE, {}, 3);
    expect(progress.stages.get(stage1?.id ?? '')?.status).toBe('completed');
    expect(progress.stages.get(stage2?.id ?? '')?.status).toBe('completed');
    expect(progress.lessons.get(ids(stage3)[0] ?? '')?.status).toBe('available');
    expect(nextId(progress.next)).toBe(ids(stage3)[0]);
    expect(progress.stagesPassed).toBe(2);
    expect(progress.level.name).toBe('Beginner 3');
  });

  it('keeps the earlier lessons and tests open to play', () => {
    const progress = courseProgress(COURSE, {}, 2);
    expect(progress.lessons.get(ids(stage1)[0] ?? '')?.status).toBe('available');
    expect(progress.lessons.get(ids(stage1)[1] ?? '')?.status).toBe('locked');
    expect(progress.stages.get(stage1?.id ?? '')?.test).toEqual({ status: 'available', stars: 0 });
  });

  it('falls back to earlier steps once the later stages are done', () => {
    const progress = courseProgress(COURSE, stagesDone([stage2, stage3]), 2);
    expect(nextId(progress.next)).toBe(ids(stage1)[0]);
  });

  it('ignores a starting stage beyond the playable ones for unlocking previews', () => {
    const progress = courseProgress(COURSE, {}, 8);
    expect(progress.stages.get(stage4?.id ?? '')?.status).toBe('preview');
    expect(progress.stagesPassed).toBe(3);
  });
});

describe('isStagePassed', () => {
  it('needs the stage test passed', () => {
    if (!stage1 || !stage4) throw new Error('missing stages');
    expect(isStagePassed(stage1, stagesDone([stage1], false))).toBe(false);
    expect(isStagePassed(stage1, done([testId(stage1)], 1))).toBe(true);
    expect(isStagePassed(stage4, {})).toBe(false);
  });
});

describe('levels', () => {
  it.each([
    [0, 'Beginner 1', { name: 'Beginner 2', testsNeeded: 1 }],
    [1, 'Beginner 2', { name: 'Beginner 3', testsNeeded: 1 }],
    [3, 'Intermediate 1', { name: 'Intermediate 2', testsNeeded: 2 }],
    [4, 'Intermediate 1', { name: 'Intermediate 2', testsNeeded: 1 }],
    [7, 'Intermediate 3', null],
    [8, 'Intermediate 3', null],
  ])('after %i stage tests: %s', (tests, name, next) => {
    expect(levelFor(tests)).toMatchObject({ name, next });
  });

  it('runs from Beginner 1 to Intermediate 3', () => {
    expect(LEVELS.map((level) => level.name)).toEqual([
      'Beginner 1',
      'Beginner 2',
      'Beginner 3',
      'Intermediate 1',
      'Intermediate 2',
      'Intermediate 3',
    ]);
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
