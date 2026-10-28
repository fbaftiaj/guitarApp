import { create } from 'zustand';
import {
  listLessonProgress,
  mergeLessonAttempt,
  recordLessonAttempt,
} from '@/storage/lessonProgress';
import type { LessonAttempt, LessonProgress } from '@/storage/types';

/**
 * Course progress: the best result per lesson, loaded from IndexedDB once
 * per visit and updated as lesson checks are passed. If storage fails, the
 * progress is still kept in memory, so the current visit carries on.
 */

export type ProgressStatus = 'idle' | 'ready' | 'unavailable';

export type NewAttempt = Omit<LessonAttempt, 'at'> & { at?: number };

interface ProgressState {
  lessons: Readonly<Record<string, LessonProgress>>;
  /** 'unavailable' when saved progress could not be read or written. */
  status: ProgressStatus;
  /** Reads the saved progress; results recorded meanwhile are kept. */
  load: () => Promise<void>;
  /** Records a lesson check or stage test (now, unless `at` says otherwise) and returns the new progress. */
  recordAttempt: (lessonId: string, attempt: NewAttempt) => Promise<LessonProgress>;
}

export const useProgressStore = create<ProgressState>()((set, get) => ({
  lessons: {},
  status: 'idle',
  load: async () => {
    try {
      const saved = await listLessonProgress();
      set((state) => ({
        lessons: {
          ...Object.fromEntries(saved.map((progress) => [progress.lessonId, progress])),
          // Recorded during this visit, so at least as new as what was read.
          ...state.lessons,
        },
        status: state.status === 'unavailable' ? 'unavailable' : 'ready',
      }));
    } catch (cause) {
      console.error('[progress] could not load lesson progress', cause);
      set({ status: 'unavailable' });
    }
  },
  recordAttempt: async (lessonId, { at = Date.now(), ...result }) => {
    const attempt: LessonAttempt = { ...result, at };
    let progress: LessonProgress;
    try {
      progress = await recordLessonAttempt(lessonId, attempt);
    } catch (cause) {
      console.error('[progress] could not save lesson progress', cause);
      progress = mergeLessonAttempt(get().lessons[lessonId], lessonId, attempt);
      set({ status: 'unavailable' });
    }
    set((state) => ({ lessons: { ...state.lessons, [lessonId]: progress } }));
    return progress;
  },
}));

let initialLoad: Promise<void> | null = null;

/** Loads the saved progress once per visit; screens that show progress await it. */
export function whenProgressLoaded(): Promise<void> {
  initialLoad ??= useProgressStore.getState().load();
  return initialLoad;
}
