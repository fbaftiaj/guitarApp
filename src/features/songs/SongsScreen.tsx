import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { songPath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { SONGS, type Song } from '@/content/songs';
import { originLabel } from './songLabels';

function details(song: Song): string {
  const { beats, unit } = song.exercise.timeSignature;
  const what = song.exercise.kind === 'notes' ? 'Melody' : song.chords.join(' ');
  return `${what} · ${beats}/${unit} · ${song.exercise.tempo} BPM`;
}

/** Songs ordered by the stage they suit. */
const ORDERED = [...SONGS].sort((a, b) => a.stage - b.stage);

export function SongsScreen() {
  return (
    <Screen title="Songs">
      <p className="mb-4 text-sm text-pretty text-fg-muted">
        Traditional and public-domain songs, plus pieces written for FretPath. Each one shows the
        stage it suits, and plays in the practicer with loop, speed-up and listening.
      </p>
      <ul className="space-y-3">
        {ORDERED.map((song) => (
          <li key={song.id}>
            <Link
              to={songPath(song.id)}
              className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{song.title}</span>
                <span className="mt-0.5 block text-sm text-pretty text-fg-muted">
                  {song.credit}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-fg-subtle">
                  <span className="rounded-full border border-border px-2 py-0.5">
                    Stage {song.stage}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5">
                    {originLabel(song)}
                  </span>
                  <span>{details(song)}</span>
                </span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
