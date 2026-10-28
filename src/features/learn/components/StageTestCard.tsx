import { ClipboardCheck, Lock } from 'lucide-react';
import { stageTestPath } from '@/app/navigation';
import type { Stage, StageTest } from '@/content/course';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { StarRating } from '@/ui/StarRating';
import type { TestState } from '../progression';

/** The stage test at the end of a stage page: locked, ready, or passed with its stars. */
export function StageTestCard({
  stage,
  test,
  state,
}: {
  stage: Stage;
  test: StageTest;
  state: TestState;
}) {
  return (
    <Card className="mt-6" aria-labelledby={`test-${test.id}`}>
      <div className="flex items-start gap-3">
        <ClipboardCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-accent-text" />
        <div className="min-w-0 flex-1">
          <h2 id={`test-${test.id}`} className="font-semibold">
            {test.title}
          </h2>
          <p className="mt-0.5 text-sm text-pretty text-fg-muted">{test.summary}</p>
        </div>
        {state.status === 'passed' && <StarRating stars={state.stars} size="sm" />}
      </div>
      {state.status === 'locked' ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
          <Lock aria-hidden className="size-4 shrink-0" />
          Complete every lesson in Stage {stage.number} to take the test.
        </p>
      ) : (
        <ButtonLink
          to={stageTestPath(stage.id)}
          variant={state.status === 'passed' ? 'secondary' : 'primary'}
          fullWidth
          className="mt-4"
        >
          {state.status === 'passed' ? 'Take it again' : 'Take the test'}
        </ButtonLink>
      )}
    </Card>
  );
}
