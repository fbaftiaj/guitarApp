import type { Course } from '@/content/course';
import { lessonChords } from '../learn/lessonVisuals';
import type { ProgressByLesson } from '../learn/progression';

/** Chords from every completed lesson, in the order the course teaches them. */
export function learnedChords(course: Course, progress: ProgressByLesson): string[] {
  const chords = course.lessons
    .filter((lesson) => (progress[lesson.id]?.stars ?? 0) > 0)
    .flatMap((lesson) => lessonChords(lesson.exercise));
  return [...new Set(chords)];
}
