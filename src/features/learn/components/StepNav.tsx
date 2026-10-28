import { Link } from 'react-router';
import { LESSON_STEPS, lessonPath, type LessonStep } from '@/app/navigation';
import { cx } from '@/ui/cx';
import { STEP_INFO } from '../lessonSteps';

/** Learn → Listen → Practice → Check, with the current step marked. */
export function StepNav({ lessonId, current }: { lessonId: string; current: LessonStep }) {
  return (
    <nav aria-label="Lesson steps">
      <ol className="grid grid-cols-4 gap-1 rounded-card border border-border bg-surface p-1">
        {LESSON_STEPS.map((step, i) => {
          const { label, icon: Icon } = STEP_INFO[step];
          const active = step === current;
          return (
            <li key={step}>
              <Link
                to={lessonPath(lessonId, step)}
                replace
                aria-current={active ? 'step' : undefined}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-semibold transition-colors',
                  active
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:bg-surface-raised hover:text-fg',
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span>
                  <span className="sr-only">Step {i + 1}: </span>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
