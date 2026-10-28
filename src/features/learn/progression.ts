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
 *
 * A player who chose a later starting stage at setup has the stages before
 * it counted as passed (their lessons stay open to play), and carries on
 * from the chosen stage.
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
  /** Stages passed by their test, or credited by the starting stage. */
  stagesPassed: number;
  level: Level;
}

export type ProgressByLesson = Readonly<Partial<Record<string, LessonProgress>>>;

/** Levels and the number of stages passed to reach each one. */
export const LEVELS = [
  { name: 'Beginner 1', stagesPassed: 0 },
  { name: 'Beginner 2', stagesPassed: 1 },
  { name: 'Beginner 3', stagesPassed: 2 },
  { name: 'Intermediate 1', stagesPassed: 3 },
  { name: 'Intermediate 2', stagesPassed: 5 },
  { name: 'Intermediate 3', stagesPassed: 7 },
] as const;

const starsOf = (progress: LessonProgress | undefined): StarCount => progress?.stars ?? 0;

export function levelFor(stagesPassed: number): Level {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (stagesPassed >= level.stagesPassed) index = i;
  });
  const following = LEVELS[index + 1];
  return {
    index,
    name: LEVELS[index]?.name ?? LEVELS[0].name,
    next: following
      ? { name: following.name, testsNeeded: following.stagesPassed - stagesPassed }
      : null,
  };
}

/** Whether `stage` is passed by its test (which opens the next one). */
export function isStagePassed(stage: Stage, progress: ProgressByLesson): boolean {
  return stage.test !== null && starsOf(progress[stage.test.id]) > 0;
}

export function courseProgress(
  course: Course,
  progress: ProgressByLesson,
  /** The stage chosen at setup: the stages before it count as passed. */
  startStage = 1,
): CourseProgress {
  const lessons = new Map<string, LessonState>();
  const stages = new Map<string, StageState>();
  /** Open steps not yet done, in course order. */
  const open: { step: NextStep; stage: Stage }[] = [];
  const offer = (step: NextStep, stage: Stage) => {
    open.push({ step, stage });
  };
  let previousPassed = true;
  let stagesPassed = 0;

  for (const stage of course.stages) {
    const opened = previousPassed && stage.lessons.length > 0;
    let previousCompleted = true;
    let completedLessons = 0;
    let stars = 0;
    for (const lesson of stage.lessons) {
      const lessonStars = starsOf(progress[lesson.id]);
      const completed = lessonStars > 0;
      const status: LessonStatus = completed
        ? 'completed'
        : opened && previousCompleted
          ? 'available'
          : 'locked';
      lessons.set(lesson.id, { status, stars: lessonStars });
      if (status === 'available') offer({ kind: 'lesson', lesson }, stage);
      if (completed) completedLessons++;
      stars += lessonStars;
      previousCompleted = completed;
    }

    const credited = stage.lessons.length > 0 && stage.number < startStage;
    const passed = isStagePassed(stage, progress) || credited;
    if (passed) stagesPassed++;
    let test: TestState | null = null;
    if (stage.test) {
      const allDone = completedLessons === stage.lessons.length;
      // A credited stage's test can still be taken, for its stars.
      const status: TestStatus = isStagePassed(stage, progress)
        ? 'passed'
        : opened && (allDone || credited)
          ? 'available'
          : 'locked';
      test = { status, stars: starsOf(progress[stage.test.id]) };
      if (status === 'available' && !credited)
        offer({ kind: 'test', test: stage.test, stage }, stage);
    }
    stages.set(stage.id, {
      status:
        stage.lessons.length === 0
          ? 'preview'
          : passed
            ? 'completed'
            : opened || completedLessons > 0
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
  return {
    lessons,
    stages,
    // Carry on from the starting stage if anything is open there, else from earlier.
    next: (open.find(({ stage }) => stage.number >= startStage) ?? open[0])?.step ?? null,
    stagesPassed,
    level: levelFor(stagesPassed),
  };
}

/** The lesson after `lessonId` in course order, or null after the last one. */
export function lessonAfter(course: Course, lessonId: string): Lesson | null {
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  return index < 0 ? null : (course.lessons[index + 1] ?? null);
}
