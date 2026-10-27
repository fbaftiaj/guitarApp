import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ButtonLink } from '@/ui/ButtonLink';
import { ErrorState } from '@/ui/ErrorState';
import { isChunkLoadError } from './errors';
import { HOME_PATH } from './navigation';
import { Screen } from './Screen';

/** Error boundary for a single screen; the navigation shell stays usable. */
export function RouteErrorScreen() {
  const error = useRouteError();
  const offline = isChunkLoadError(error);

  useEffect(() => {
    console.error('[route]', error);
  }, [error]);

  return (
    <Screen title="Something went wrong">
      <ErrorState
        title={offline ? 'This screen couldn’t load' : 'This screen hit a problem'}
        description={
          offline
            ? 'Check your internet connection, then reload. Screens you have opened before work offline.'
            : 'Reload to try again. If it keeps happening, restart the app.'
        }
        onRetry={() => {
          window.location.reload();
        }}
        retryLabel="Reload"
        secondaryAction={
          <ButtonLink to={HOME_PATH} variant="secondary">
            Go to the tuner
          </ButtonLink>
        }
      />
    </Screen>
  );
}
