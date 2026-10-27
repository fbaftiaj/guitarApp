import { CloudCheck, RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/ui/Button';
import { Notice } from '../Notice';

/** How often a long-running session checks for a new deployment. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and tells the user when the app is ready
 * offline or when a new version is waiting. Updating is always the user's
 * choice so a reload never interrupts a practice session.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error: unknown) {
      console.error('[pwa] Service worker registration failed', error);
    },
  });

  const dismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  if (needRefresh) {
    return (
      <Notice icon={RefreshCw} onDismiss={dismiss} dismissLabel="Later">
        <p>A new version of FretPath is available.</p>
        <Button size="md" className="mt-3" onClick={() => void updateServiceWorker(true)}>
          Reload to update
        </Button>
      </Notice>
    );
  }

  if (offlineReady) {
    return (
      <Notice icon={CloudCheck} onDismiss={dismiss}>
        <p>FretPath is ready to work offline.</p>
      </Notice>
    );
  }

  return null;
}
