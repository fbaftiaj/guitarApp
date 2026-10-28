import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { exercisePath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { EXERCISES, type Exercise } from '@/content/exercises';

function summary(exercise: Exercise): string {
  const { beats, unit } = exercise.timeSignature;
  const kind = exercise.kind === 'chords' ? 'Chords' : 'Single notes';
  return `${kind} · ${beats}/${unit} · ${exercise.bars.length} bars · ${exercise.tempo} BPM`;
}

export function PracticeScreen() {
  return (
    <Screen title="Practice">
      <p className="mb-4 text-sm text-pretty text-fg-muted">
        Play along with a scrolling timeline. Each exercise starts slower than its target tempo and
        speeds up as you loop it.
      </p>
      <ul className="space-y-3">
        {EXERCISES.map((exercise) => (
          <li key={exercise.id}>
            <Link
              to={exercisePath(exercise.id)}
              className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{exercise.title}</span>
                <span className="mt-0.5 block text-sm text-pretty text-fg-muted">
                  {exercise.description}
                </span>
                <span className="mt-2 block text-xs font-medium text-fg-subtle">
                  {summary(exercise)}
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
