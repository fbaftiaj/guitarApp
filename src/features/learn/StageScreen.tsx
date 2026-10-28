import { CircleCheck, GraduationCap, Lock, Music, Play } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { LEARN_PATH, lessonPath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { findStage, type Lesson } from '@/content/course';
import { ButtonLink } from '@/ui/ButtonLink';
import { cx } from '@/ui/cx';
import { EmptyState } from '@/ui/EmptyState';
import { StarRating } from '@/ui/StarRating';
import { ProgressMeter } from './components/ProgressMeter';
import { StorageNotice } from './components/StorageNotice';
import type { LessonState } from './progression';
import { useCourseProgress } from './useCourseProgress';

function LessonRow({
  lesson,
  number,
  state,
}: {
  lesson: Lesson;
  number: number;
  state: LessonState;
}) {
  const locked = state.status === 'locked';
  const content = (
    <>
      <span
        aria-hidden
        className={cx(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          state.status === 'completed'
            ? 'bg-accent text-accent-fg'
            : state.status === 'available'
              ? 'border-2 border-accent text-accent-text'
              : 'bg-surface-raised text-fg-subtle',
        )}
      >
        {state.status === 'completed' ? <CircleCheck className="size-5" /> : number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {lesson.songId && <Music aria-hidden className="size-4 shrink-0 text-accent-text" />}
          {lesson.title}
        </span>
        <span className="mt-0.5 block text-sm text-pretty text-fg-muted">{lesson.summary}</span>
      </span>
      {state.status === 'completed' ? (
        <StarRating stars={state.stars} size="sm" className="mt-1" />
      ) : state.status === 'available' ? (
        <Play aria-hidden className="mt-1 size-5 shrink-0 text-accent-text" />
      ) : (
        <Lock aria-hidden className="mt-1 size-4 shrink-0 text-fg-subtle" />
      )}
      <span className="sr-only">
        {state.status === 'completed'
          ? ', completed'
          : state.status === 'locked'
            ? ', locked'
            : ', up next'}
      </span>
    </>
  );
  const classes = 'flex items-start gap-3 rounded-card p-3';
  return locked ? (
    <div className={classes}>{content}</div>
  ) : (
    <Link
      to={lessonPath(lesson.id)}
      className={cx(classes, 'transition-colors hover:bg-surface-raised')}
    >
      {content}
    </Link>
  );
}

export function StageScreen() {
  const { stageId = '' } = useParams();
  const stage = findStage(stageId);
  const progress = useCourseProgress();
  const state = stage ? progress.stages.get(stage.id) : undefined;

  if (!stage || !state) {
    return (
      <Screen title="Stage not found" backTo={LEARN_PATH} backLabel="Learn">
        <EmptyState
          icon={GraduationCap}
          title="No such stage"
          description="This stage doesn’t exist. It may have been renamed or removed."
          action={<ButtonLink to={LEARN_PATH}>All stages</ButtonLink>}
        />
      </Screen>
    );
  }

  return (
    <Screen title={`Stage ${stage.number}: ${stage.title}`} backTo={LEARN_PATH} backLabel="Learn">
      <StorageNotice />
      <p className="text-pretty text-fg-muted">{stage.summary}</p>
      {state.status === 'preview' ? (
        <EmptyState
          icon={GraduationCap}
          title="Coming soon"
          description="The lessons for this stage are on their way."
        />
      ) : (
        <>
          <ProgressMeter
            done={state.completedLessons}
            total={state.totalLessons}
            className="mt-3"
          />
          {state.status === 'locked' && (
            <p className="mt-4 flex items-center gap-2 rounded-control border border-border bg-surface p-3 text-sm">
              <Lock aria-hidden className="size-4 shrink-0 text-fg-muted" />
              Complete Stage {stage.number - 1} to unlock this stage.
            </p>
          )}
          {stage.units.map((unit, unitIndex) => {
            const offset = stage.units
              .slice(0, unitIndex)
              .reduce((count, previous) => count + previous.lessons.length, 0);
            return (
              <section key={unit.id} className="mt-6" aria-labelledby={`unit-${unit.id}`}>
                <h2 id={`unit-${unit.id}`} className="font-semibold">
                  <span className="text-fg-muted">Unit {unitIndex + 1} ·</span> {unit.title}
                </h2>
                <p className="mt-0.5 text-sm text-fg-muted">{unit.summary}</p>
                <ol className="mt-2 rounded-card border border-border bg-surface p-1">
                  {unit.lessons.map((lesson, i) => {
                    const lessonState = progress.lessons.get(lesson.id);
                    return lessonState ? (
                      <li key={lesson.id}>
                        <LessonRow lesson={lesson} number={offset + i + 1} state={lessonState} />
                      </li>
                    ) : null;
                  })}
                </ol>
              </section>
            );
          })}
        </>
      )}
    </Screen>
  );
}
