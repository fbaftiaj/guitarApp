import { useEffect, useSyncExternalStore } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { LIGHT_SCHEME_QUERY, applyTheme, resolveTheme, systemPrefersLight } from './theme';

function subscribeToSystemScheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(LIGHT_SCHEME_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** Keeps <html data-theme> in sync with the setting and, for "system", the OS. */
export function useThemeSync(): void {
  const preference = useSettingsStore((state) => state.theme);
  const prefersLight = useSyncExternalStore(subscribeToSystemScheme, systemPrefersLight);
  const theme = resolveTheme(preference, prefersLight);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
