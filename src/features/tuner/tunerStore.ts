import { z } from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BODY_STYLES, DEFAULT_INSTRUMENT_ID, type BodyStyle } from '@/content/instruments';
import { createIdbPersistStorage, mergeValidated, whenHydrated } from '@/storage/persistStorage';
import type { TunerMode } from './tunerEngine';

/**
 * The tuner remembers the instrument, the last tuning used on each
 * instrument, the guitar type and the mode. Ids are validated against the
 * catalog when used (see `resolveSelection`), so a tuning removed from the
 * catalog falls back to the instrument's default.
 */
const persistedTunerSchema = z.object({
  instrumentId: z.catch(z.string(), DEFAULT_INSTRUMENT_ID),
  tuningByInstrument: z.catch(z.record(z.string(), z.string()), {}),
  bodyStyle: z.catch(z.enum(BODY_STYLES), 'acoustic'),
  mode: z.catch(z.enum(['auto', 'manual', 'chromatic']), 'auto'),
});

export type TunerPreferences = z.infer<typeof persistedTunerSchema>;

export const DEFAULT_TUNER_PREFERENCES: TunerPreferences = {
  instrumentId: DEFAULT_INSTRUMENT_ID,
  tuningByInstrument: {},
  bodyStyle: 'acoustic',
  mode: 'auto',
};

interface TunerState extends TunerPreferences {
  selectInstrument: (instrumentId: string) => void;
  /** Selects a tuning for the current instrument. */
  selectTuning: (tuningId: string) => void;
  setBodyStyle: (bodyStyle: BodyStyle) => void;
  setMode: (mode: TunerMode) => void;
}

export const TUNER_STORAGE_KEY = 'tuner';

export const useTunerStore = create<TunerState>()(
  persist(
    (set) => ({
      ...DEFAULT_TUNER_PREFERENCES,
      selectInstrument: (instrumentId) => {
        set({ instrumentId });
      },
      selectTuning: (tuningId) => {
        set((state) => ({
          tuningByInstrument: { ...state.tuningByInstrument, [state.instrumentId]: tuningId },
        }));
      },
      setBodyStyle: (bodyStyle) => {
        set({ bodyStyle });
      },
      setMode: (mode) => {
        set({ mode });
      },
    }),
    {
      name: TUNER_STORAGE_KEY,
      version: 1,
      storage: createIdbPersistStorage<TunerPreferences>(),
      partialize: ({ instrumentId, tuningByInstrument, bodyStyle, mode }): TunerPreferences => ({
        instrumentId,
        tuningByInstrument,
        bodyStyle,
        mode,
      }),
      merge: mergeValidated(persistedTunerSchema),
    },
  ),
);

/** Resolves once the saved tuner preferences have loaded (or after a timeout). */
export function whenTunerHydrated(): Promise<void> {
  return whenHydrated(useTunerStore.persist);
}
