import type { Course, Lesson, Stage, StageTest } from '@/content/course';
import type { LessonProgress, StarCount } from '@/storage/types';

/**
 * Unlock rules. Lessons unlock one after another: a lesson opens once the
 * one before it in its stage is completed (has earned a star). A stage's
 * test opens once every lesson of the stage is completed, and passing the
 * test opens the next stage and raises the player's level. Preview stages,
 * which have no lessons yet, stay closed. A lesson already completed always
 * stays open, even if the content around it changes.
 *
 * Stage tests keep their results with the lessons', under the test's id.
 */

export type LessonStatus = 'locked' | 'available' | 'completed';
export type StageStatus = 'preview' | 'locked' | 'available' | 'completed';
export type TestStatus = 'locked' | 'available' | 'passed';

export interface LessonState {
  status: LessonStatus;
  stars: StarCount;
}

export interface TestState {
  status: TestStatus;
  stars: StarCount;
}

export interface StageState {
  status: StageStatus;
  completedLessons: number;
  totalLessons: number;
  stars: number;
  /** Three per lesson. */
  maxStars: number;
  /** Null for a preview stage. */
  test: TestState | null;
}

/** Where to carry on: a lesson, or a stage's test once its lessons are done. */
export type NextStep =
  { kind: 'lesson'; lesson: Lesson } | { kind: 'test'; test: StageTest; stage: Stage };

export interface Level {
  /** 0-based, into LEVELS. */
  index: number;
  name: string;
  /** Stage tests still to pass for the next level, or null at the top. */
  next: { name: string; testsNeeded: number } | null;
}

export interface CourseProgress {
  lessons: ReadonlyMap<string, LessonState>;
  stages: ReadonlyMap<string, StageState>;
  /** The first open lesson or test not yet completed, in course order; null when all are done. */
  next: NextStep | null;
  testsPassed: number;
  level: Level;
}

export type ProgressByLesson = Readonly<Partial<Record<string, LessonProgress>>>;

/** Levels and the number of stage tests passed to reach each one. */
export const LEVELS = [
  { name: 'Beginner 1', testsPassed: 0 },
  { name: 'Beginner 2', testsPassed: 1 },
  { name: 'Beginner 3', testsPassed: 2 },
  { name: 'Intermediate 1', testsPassed: 3 },
  { name: 'Intermediate 2', testsPassed: 5 },
  { name: 'Intermediate 3', testsPassed: 7 },
] as const;

const starsOf = (progress: LessonProgress | undefined): StarCount => progress?.stars ?? 0;

export function levelFor(testsPassed: number): Level {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (testsPassed >= level.testsPassed) index = i;
  });
  const following = LEVELS[index + 1];
  return {
    index,
    name: LEVELS[index]?.name ?? LEVELS[0].name,
    next: following
      ? { name: following.name, testsNeeded: following.testsPassed - testsPassed }
      : null,
  };
}

/** Whether `stage` is passed, which opens the next one. */
export function isStagePassed(stage: Stage, progress: ProgressByLesson): boolean {
  return stage.test !== null && starsOf(progress[stage.test.id]) > 0;
}

export function courseProgress(course: Course, progress: ProgressByLesson): CourseProgress {
  const lessons = new Map<string, LessonState>();
  const stages = new Map<string, StageState>();
  let next: NextStep | null = null;
  let previousPassed = true;
  let testsPassed = 0;

  for (const stage of course.stages) {
    const open = previousPassed && stage.lessons.length > 0;
    let previousCompleted = true;
    let completedLessons = 0;
    let stars = 0;
    for (const lesson of stage.lessons) {
      const lessonStars = starsOf(progress[lesson.id]);
      const completed = lessonStars > 0;
      const status: LessonStatus = completed
        ? 'completed'
        : open && previousCompleted
          ? 'available'
          : 'locked';
      lessons.set(lesson.id, { status, stars: lessonStars });
      if (status === 'available') next ??= { kind: 'lesson', lesson };
      if (completed) completedLessons++;
      stars += lessonStars;
      previousCompleted = completed;
    }

    const passed = isStagePassed(stage, progress);
    if (passed) testsPassed++;
    let test: TestState | null = null;
    if (stage.test) {
      const allDone = completedLessons === stage.lessons.length;
      const status: TestStatus = passed ? 'passed' : open && allDone ? 'available' : 'locked';
      test = { status, stars: starsOf(progress[stage.test.id]) };
      if (status === 'available') next ??= { kind: 'test', test: stage.test, stage };
    }
    stages.set(stage.id, {
      status:
        stage.lessons.length === 0
          ? 'preview'
          : passed
            ? 'completed'
            : open || completedLessons > 0
              ? 'available'
              : 'locked',
      completedLessons,
      totalLessons: stage.lessons.length,
      stars,
      maxStars: stage.lessons.length * 3,
      test,
    });
    previousPassed = passed;
  }
  return { lessons, stages, next, testsPassed, level: levelFor(testsPassed) };
}

/** The lesson after `lessonId` in course order, or null after the last one. */
export function lessonAfter(course: Course, lessonId: string): Lesson | null {
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  return index < 0 ? null : (course.lessons[index + 1] ?? null);
}
