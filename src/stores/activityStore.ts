import { z } from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localDay } from '@/lib/time/localDay';
import { createIdbPersistStorage, mergeValidated, whenHydrated } from '@/storage/persistStorage';

/**
 * Time spent playing, per local calendar day, for the practice streak and
 * total minutes. It counts every play-along (scored or not), lesson Listen
 * steps and checks; scored results themselves live in the sessions store.
 */

/** Longest stretch counted at once, in case a stop was never seen (e.g. a crash). */
export const MAX_STRETCH_SECONDS = 30 * 60;

const persistedActivitySchema = z.object({
  /** Seconds played, by "YYYY-MM-DD". */
  days: z.catch(z.record(z.string(), z.number().check(z.nonnegative())), {}),
});

export type PersistedActivity = z.infer<typeof persistedActivitySchema>;

interface ActivityState extends PersistedActivity {
  /** Adds `seconds` of playing to the day of `at`. */
  addPractice: (seconds: number, at?: number) => void;
}

export const ACTIVITY_STORAGE_KEY = 'activity';

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      days: {},
      addPractice: (seconds, at = Date.now()) => {
        const added = Math.min(MAX_STRETCH_SECONDS, seconds);
        if (!Number.isFinite(added) || added <= 0) return;
        const day = localDay(at);
        set((state) => ({ days: { ...state.days, [day]: (state.days[day] ?? 0) + added } }));
      },
    }),
    {
      name: ACTIVITY_STORAGE_KEY,
      version: 1,
      storage: createIdbPersistStorage<PersistedActivity>(),
      partialize: ({ days }): PersistedActivity => ({ days }),
      merge: mergeValidated(persistedActivitySchema),
    },
  ),
);

/** Resolves once the saved activity has loaded (or after a timeout). */
export function whenActivityHydrated(): Promise<void> {
  return whenHydrated(useActivityStore.persist);
}
