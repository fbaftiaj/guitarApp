import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorState } from '@/ui/ErrorState';

/** Last-resort boundary when the app shell itself fails to render. */
export function AppCrashScreen() {
  const error = useRouteError();

  useEffect(() => {
    console.error('[app]', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        title="FretPath ran into a problem"
        description="Reload the app to continue. Your saved progress is not affected."
        onRetry={() => {
          window.location.reload();
        }}
        retryLabel="Reload"
      />
    </main>
  );
}
