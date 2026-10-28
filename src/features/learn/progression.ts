import type { Course, Lesson, Stage } from '@/content/course';
import type { LessonProgress, StarCount } from '@/storage/types';

/**
 * Unlock rules. Lessons unlock one after another: a lesson opens once the
 * one before it in its stage is completed (has earned a star). A stage's
 * first lesson opens once the stage before it is passed — for now, by
 * completing all of its lessons (stage tests replace this in Milestone 6).
 * Preview stages, which have no lessons yet, stay closed. A lesson already
 * completed always stays open, even if the content around it changes.
 */

export type LessonStatus = 'locked' | 'available' | 'completed';
export type StageStatus = 'preview' | 'locked' | 'available' | 'completed';

export interface LessonState {
  status: LessonStatus;
  stars: StarCount;
}

export interface StageState {
  status: StageStatus;
  completedLessons: number;
  totalLessons: number;
  stars: number;
  /** Three per lesson. */
  maxStars: number;
}

export interface CourseProgress {
  lessons: ReadonlyMap<string, LessonState>;
  stages: ReadonlyMap<string, StageState>;
  /** Where to carry on: the first open lesson not yet completed, or null when all are done. */
  next: Lesson | null;
}

export type ProgressByLesson = Readonly<Partial<Record<string, LessonProgress>>>;

const isCompleted = (progress: LessonProgress | undefined): boolean => (progress?.stars ?? 0) > 0;

/** Whether `stage` counts as passed, which opens the next one. */
export function isStagePassed(stage: Stage, progress: ProgressByLesson): boolean {
  return (
    stage.lessons.length > 0 && stage.lessons.every((lesson) => isCompleted(progress[lesson.id]))
  );
}

export function courseProgress(course: Course, progress: ProgressByLesson): CourseProgress {
  const lessons = new Map<string, LessonState>();
  const stages = new Map<string, StageState>();
  let next: Lesson | null = null;
  let previousPassed = true;

  for (const stage of course.stages) {
    const open = previousPassed && stage.lessons.length > 0;
    let previousCompleted = true;
    let completedLessons = 0;
    let stars = 0;
    for (const lesson of stage.lessons) {
      const saved = progress[lesson.id];
      const completed = isCompleted(saved);
      const status: LessonStatus = completed
        ? 'completed'
        : open && previousCompleted
          ? 'available'
          : 'locked';
      lessons.set(lesson.id, { status, stars: saved?.stars ?? 0 });
      if (status === 'available') next ??= lesson;
      if (completed) completedLessons++;
      stars += saved?.stars ?? 0;
      previousCompleted = completed;
    }

    const passed = isStagePassed(stage, progress);
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
    });
    previousPassed = passed;
  }
  return { lessons, stages, next };
}

/** The lesson after `lessonId` in course order, or null after the last one. */
export function lessonAfter(course: Course, lessonId: string): Lesson | null {
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  return index < 0 ? null : (course.lessons[index + 1] ?? null);
}
