import { Guitar } from 'lucide-react';
import { Screen } from '@/app/Screen';
import { EmptyState } from '@/ui/EmptyState';

export function PracticeScreen() {
  return (
    <Screen title="Practice">
      <EmptyState
        icon={Guitar}
        title="Play along"
        description="Practise chords, riffs and rhythms with a scrolling timeline that listens to what you play. Exercises will appear here."
      />
    </Screen>
  );
}
