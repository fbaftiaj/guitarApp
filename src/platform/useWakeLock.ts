import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (tuning or practising hands-free).
 * Browsers drop the lock when the page is hidden, so it is re-acquired when
 * the page becomes visible again. Unsupported browsers are ignored.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) await lock.release();
        else sentinel = lock;
      } catch {
        // Refused (e.g. battery saver): the screen may sleep, nothing else breaks.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (sentinel?.released ?? true)) void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
