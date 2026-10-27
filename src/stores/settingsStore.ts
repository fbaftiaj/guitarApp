import { z } from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEME_PREFERENCES, type ThemePreference } from '@/app/theme';
import { createIdbPersistStorage } from '@/storage/persistStorage';

/**
 * Persisted data is untrusted (older app versions, manual edits): every field
 * falls back to its default on its own instead of discarding all settings.
 */
const persistedSettingsSchema = z.object({
  theme: z.catch(z.enum(THEME_PREFERENCES), 'dark'),
});

export type PersistedSettings = z.infer<typeof persistedSettingsSchema>;

export const DEFAULT_SETTINGS: PersistedSettings = {
  theme: 'dark',
};

interface SettingsState extends PersistedSettings {
  setTheme: (theme: ThemePreference) => void;
}

export const SETTINGS_STORAGE_KEY = 'settings';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => {
        set({ theme });
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createIdbPersistStorage<PersistedSettings>(),
      partialize: ({ theme }): PersistedSettings => ({ theme }),
      merge: (persisted, current) => {
        const parsed = persistedSettingsSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/**
 * Resolves once persisted settings have been loaded, or after `timeoutMs`
 * so a hung IndexedDB open (seen on some WebKit builds) never blocks startup;
 * the store still updates if hydration finishes later.
 */
export function whenSettingsHydrated(timeoutMs = 1500): Promise<void> {
  const api = useSettingsStore.persist;
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = api.onFinishHydration(finish);
  });
}
