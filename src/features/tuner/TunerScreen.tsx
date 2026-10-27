import { Gauge } from 'lucide-react';
import { Screen } from '@/app/Screen';
import { EmptyState } from '@/ui/EmptyState';

export function TunerScreen() {
  return (
    <Screen title="Tuner">
      <EmptyState
        icon={Gauge}
        title="Precision tuner"
        description="Auto, manual and chromatic tuning for guitar, bass and ukulele, with reference tones for tuning by ear. It’s being built next."
      />
    </Screen>
  );
}
