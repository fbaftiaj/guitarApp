import { GraduationCap } from 'lucide-react';
import { Screen } from '@/app/Screen';
import { EmptyState } from '@/ui/EmptyState';

export function LearnScreen() {
  return (
    <Screen title="Learn">
      <EmptyState
        icon={GraduationCap}
        title="Your guitar course"
        description="Eight stages take you from your first notes to playing complete songs. Lessons will appear here."
      />
    </Screen>
  );
}
