import { useMemo } from 'react';
import { COURSE } from '@/content/course';
import { useProgressStore } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { courseProgress, type CourseProgress } from './progression';

/** Unlock state of every stage and lesson, kept up to date as checks are passed. */
export function useCourseProgress(): CourseProgress {
  const lessons = useProgressStore((state) => state.lessons);
  const startStage = useSettingsStore((state) => state.startStage);
  return useMemo(() => courseProgress(COURSE, lessons, startStage), [lessons, startStage]);
}
