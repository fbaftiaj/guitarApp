import { Mic } from 'lucide-react';
import { Link } from 'react-router';
import { PRACTICE_PATH, trainerPath } from '@/app/navigation';
import { Card } from '@/ui/Card';
import { CHANGE_SETS, LEARN_CHORDS } from '../presets';

const chip =
  'flex min-h-11 items-center justify-center rounded-control border border-border bg-surface-raised px-3 font-semibold transition-colors hover:border-border-strong';

/** The Practice tab's way into the chord trainer. */
export function TrainerCard() {
  return (
    <Card className="mb-6 border-accent/40">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Mic aria-hidden className="size-5 text-accent-text" />
        Chord trainer
      </h2>
      <p className="mt-1 text-sm text-pretty text-fg-muted">
        It listens while you play and waits for you: learn a chord string by string, or change
        between chords at your own pace. No metronome.
      </p>
      <h3 className="mt-4 text-sm font-semibold">Learn a chord</h3>
      <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {LEARN_CHORDS.map((id) => (
          <li key={id}>
            <Link
              to={trainerPath({ chords: [id], learn: true, back: PRACTICE_PATH })}
              className={chip}
            >
              <span className="sr-only">Learn </span>
              {id}
            </Link>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-semibold">Practise chord changes</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHANGE_SETS.map((chords) => (
          <li key={chords.join('-')}>
            <Link to={trainerPath({ chords, learn: false, back: PRACTICE_PATH })} className={chip}>
              <span className="sr-only">Change between </span>
              {chords.join(' – ')}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
