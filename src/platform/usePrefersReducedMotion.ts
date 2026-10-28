import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function query(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const list = query();
  list?.addEventListener('change', onChange);
  return () => {
    list?.removeEventListener('change', onChange);
  };
}

/** True when the player asked the system for less motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => query()?.matches ?? false);
}
