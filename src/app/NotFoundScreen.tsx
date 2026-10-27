import { Compass } from 'lucide-react';
import { ButtonLink } from '@/ui/ButtonLink';
import { EmptyState } from '@/ui/EmptyState';
import { HOME_PATH } from './navigation';
import { Screen } from './Screen';

export function NotFoundScreen() {
  return (
    <Screen title="Page not found">
      <EmptyState
        icon={Compass}
        title="Nothing to play here"
        description="This page doesn’t exist. The link may be wrong or the page may have moved."
        action={<ButtonLink to={HOME_PATH}>Go to the tuner</ButtonLink>}
      />
    </Screen>
  );
}
