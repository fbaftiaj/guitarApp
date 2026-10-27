import { ListMusic } from 'lucide-react';
import { Screen } from '@/app/Screen';
import { EmptyState } from '@/ui/EmptyState';

export function SongsScreen() {
  return (
    <Screen title="Songs">
      <EmptyState
        icon={ListMusic}
        title="Song library"
        description="Traditional and public-domain songs, plus original practice pieces, arranged for your level. Songs will appear here."
      />
    </Screen>
  );
}
