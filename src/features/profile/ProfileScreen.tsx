import { CircleUser, Settings } from 'lucide-react';
import { Screen } from '@/app/Screen';
import { ButtonLink } from '@/ui/ButtonLink';
import { EmptyState } from '@/ui/EmptyState';
import { IconLink } from '@/ui/IconLink';

export function ProfileScreen() {
  return (
    <Screen
      title="Profile"
      actions={
        <IconLink to="/profile/settings" icon={Settings} label="Settings" className="-mr-2" />
      }
    >
      <EmptyState
        icon={CircleUser}
        title="Your progress lives here"
        description="Finish lessons and practice sessions to build your skill profile, practice streak and accuracy history."
        action={<ButtonLink to="/learn">Start learning</ButtonLink>}
      />
    </Screen>
  );
}
