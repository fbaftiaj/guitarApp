import { Library } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { LEARN_PATH, PROFILE_PATH, chordPath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { CHORDS } from '@/content/chords';
import { COURSE } from '@/content/course';
import { useProgressStore } from '@/stores/progressStore';
import { ButtonLink } from '@/ui/ButtonLink';
import { EmptyState } from '@/ui/EmptyState';
import { ChordDiagram } from '../practice/components/ChordDiagram';
import { learnedChords } from './learnedChords';

/** Every chord learned so far, each opening a page to check it with the microphone. */
export function ChordLibraryScreen() {
  const lessons = useProgressStore((state) => state.lessons);
  const chords = useMemo(
    () =>
      learnedChords(COURSE, lessons).flatMap((id) => {
        const chord = CHORDS.get(id);
        return chord ? [chord] : [];
      }),
    [lessons],
  );
  return (
    <Screen title="Chord library" backTo={PROFILE_PATH} backLabel="Profile">
      {chords.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No chords yet"
          description="Each chord you learn in a lesson is added here, with its diagram and a check that listens to you play it."
          action={<ButtonLink to={LEARN_PATH}>Go to the course</ButtonLink>}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-pretty text-fg-muted">
            {chords.length} of {CHORDS.size} chords learned. Open one to check it with the
            microphone.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {chords.map((chord) => (
              <li key={chord.id}>
                <Link
                  to={chordPath(chord.id)}
                  className="flex flex-col items-center gap-1 rounded-card border border-border bg-surface p-3 transition-colors hover:border-border-strong"
                >
                  <ChordDiagram chord={chord} showFingers className="pointer-events-none" />
                  <span className="font-semibold">{chord.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
