import { z } from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEME_PREFERENCES, type ThemePreference } from '@/app/theme';
import { A4_RANGE_HZ, DEFAULT_A4_HZ } from '@/lib/music/notes';
import { createIdbPersistStorage, mergeValidated, whenHydrated } from '@/storage/persistStorage';

/** Highest latency a calibration can store, in ms (Bluetooth can reach ~300). */
export const MAX_LATENCY_MS = 500;

/** Each field falls back to its default on its own instead of discarding all settings. */
const persistedSettingsSchema = z.object({
  theme: z.catch(z.enum(THEME_PREFERENCES), 'dark'),
  /** Concert pitch for A4 in Hz, used by the tuner and for practice targets. */
  referencePitch: z.catch(
    z.int().check(z.gte(A4_RANGE_HZ.min), z.lte(A4_RANGE_HZ.max)),
    DEFAULT_A4_HZ,
  ),
  /** Measured input + output latency in ms, or null when not calibrated yet. */
  latencyMs: z.catch(z.nullable(z.int().check(z.gte(0), z.lte(MAX_LATENCY_MS))), null),
});

export type PersistedSettings = z.infer<typeof persistedSettingsSchema>;

export const DEFAULT_SETTINGS: PersistedSettings = {
  theme: 'dark',
  referencePitch: DEFAULT_A4_HZ,
  latencyMs: null,
};

interface SettingsState extends PersistedSettings {
  setTheme: (theme: ThemePreference) => void;
  /** Sets A4, rounded to whole hertz and kept within 432–446 Hz. */
  setReferencePitch: (hertz: number) => void;
  /** Stores a measured latency (rounded, kept within 0–500 ms), or null to forget it. */
  setLatency: (ms: number | null) => void;
}

export const SETTINGS_STORAGE_KEY = 'settings';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => {
        set({ theme });
      },
      setReferencePitch: (hertz) => {
        const clamped = Math.min(A4_RANGE_HZ.max, Math.max(A4_RANGE_HZ.min, Math.round(hertz)));
        set({ referencePitch: Number.isFinite(clamped) ? clamped : DEFAULT_A4_HZ });
      },
      setLatency: (ms) => {
        const valid = ms !== null && Number.isFinite(ms);
        set({ latencyMs: valid ? Math.min(MAX_LATENCY_MS, Math.max(0, Math.round(ms))) : null });
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createIdbPersistStorage<PersistedSettings>(),
      partialize: ({ theme, referencePitch, latencyMs }): PersistedSettings => ({
        theme,
        referencePitch,
        latencyMs,
      }),
      merge: mergeValidated(persistedSettingsSchema),
    },
  ),
);

/** Resolves once persisted settings have loaded (or after a timeout). */
export function whenSettingsHydrated(timeoutMs?: number): Promise<void> {
  return whenHydrated(useSettingsStore.persist, timeoutMs);
}
