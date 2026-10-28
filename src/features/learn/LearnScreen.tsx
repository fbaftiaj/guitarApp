import { ChevronRight, Lock, PartyPopper, Play, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { stagePath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { COURSE, findStage, type Stage } from '@/content/course';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { cx } from '@/ui/cx';
import { ProgressMeter } from './components/ProgressMeter';
import { StorageNotice } from './components/StorageNotice';
import type { StageState } from './progression';
import { describeNextStep } from './nextStep';
import { useCourseProgress } from './useCourseProgress';

function StageCard({ stage, state }: { stage: Stage; state: StageState }) {
  const playable = state.status !== 'preview';
  const content = (
    <>
      <span
        aria-hidden
        className={cx(
          'flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold',
          state.status === 'completed'
            ? 'bg-accent text-accent-fg'
            : 'bg-surface-raised text-fg-muted',
        )}
      >
        {stage.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          <span className="sr-only">Stage {stage.number}: </span>
          {stage.title}
        </span>
        <span className="mt-0.5 block text-sm text-pretty text-fg-muted">{stage.summary}</span>
        {state.status === 'preview' ? (
          <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Sparkles aria-hidden className="size-3.5" /> Coming soon
          </span>
        ) : state.status === 'locked' ? (
          <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Lock aria-hidden className="size-3.5" /> Pass the Stage {stage.number - 1} test to
            unlock
          </span>
        ) : (
          <ProgressMeter
            done={state.completedLessons}
            total={state.totalLessons}
            className="mt-2"
          />
        )}
      </span>
      {playable && <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />}
    </>
  );
  const classes = 'flex items-start gap-3 rounded-card border border-border bg-surface p-4';
  return playable ? (
    <Link
      to={stagePath(stage.id)}
      className={cx(classes, 'transition-colors hover:border-border-strong')}
    >
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export function LearnScreen() {
  const progress = useCourseProgress();
  const next = progress.next ? describeNextStep(progress.next) : null;
  const nextStage = next ? findStage(next.stageId) : undefined;
  const started = COURSE.lessons.some(
    (lesson) => progress.lessons.get(lesson.id)?.status === 'completed',
  );

  return (
    <Screen title="Learn">
      <StorageNotice />
      {next && nextStage ? (
        <Card className="mb-6 border-accent/40">
          <p className="text-xs font-semibold tracking-wide text-accent-text uppercase">
            {started ? 'Continue' : 'Start here'} · Stage {nextStage.number}
          </p>
          <h2 className="mt-1 text-lg font-bold">{next.title}</h2>
          <p className="mt-1 text-sm text-pretty text-fg-muted">{next.summary}</p>
          <ButtonLink to={next.path} icon={Play} size="lg" fullWidth className="mt-4">
            {progress.next?.kind === 'test'
              ? 'Take the test'
              : started
                ? 'Continue'
                : 'Start the first lesson'}
          </ButtonLink>
        </Card>
      ) : (
        <Card className="mb-6 flex gap-3">
          <PartyPopper aria-hidden className="size-6 shrink-0 text-accent-text" />
          <p className="text-sm text-pretty">
            You’ve completed every lesson available so far. New stages are on their way; until then,
            keep your skills sharp with Practice and Songs.
          </p>
        </Card>
      )}

      <h2 id="stages-heading" className="mb-3 font-semibold">
        Stages
      </h2>
      <ol aria-labelledby="stages-heading" className="space-y-3">
        {COURSE.stages.map((stage) => {
          const state = progress.stages.get(stage.id);
          return state ? (
            <li key={stage.id}>
              <StageCard stage={stage} state={state} />
            </li>
          ) : null;
        })}
      </ol>
    </Screen>
  );
}
