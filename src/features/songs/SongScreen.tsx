import { ListMusic } from 'lucide-react';
import { useParams } from 'react-router';
import { SONGS_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { findSong } from '@/content/songs';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Practicer } from '../practice/Practicer';
import { SongChart } from './components/SongChart';
import { originLabel } from './songLabels';

export function SongScreen() {
  const { songId = '' } = useParams();
  const song = findSong(songId);
  if (!song) {
    return (
      <Screen title="Song not found" backTo={SONGS_PATH} backLabel="All songs">
        <EmptyState
          icon={ListMusic}
          title="No such song"
          description="This song doesn’t exist. It may have been renamed or removed."
          action={<ButtonLink to={SONGS_PATH}>All songs</ButtonLink>}
        />
      </Screen>
    );
  }
  return (
    <Screen title={song.title} backTo={SONGS_PATH} backLabel="All songs">
      <Card className="mb-4">
        <p className="text-sm text-fg-muted">
          {originLabel(song)} · {song.credit}
        </p>
        <details className="group mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-accent-text">
            Song chart
          </summary>
          <div className="mt-3">
            <SongChart song={song} />
          </div>
        </details>
      </Card>
      <Practicer key={song.id} exercise={song.exercise} />
    </Screen>
  );
}
