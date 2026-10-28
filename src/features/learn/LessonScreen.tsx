import { ArrowRight, BookOpen, Lock } from 'lucide-react';
import { Navigate, useParams } from 'react-router';
import {
  LEARN_PATH,
  LESSON_STEPS,
  isLessonStep,
  lessonPath,
  stagePath,
  type LessonStep,
} from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { COURSE, findLesson, findStage, type Lesson } from '@/content/course';
import { ButtonLink } from '@/ui/ButtonLink';
import { EmptyState } from '@/ui/EmptyState';
import { StarRating } from '@/ui/StarRating';
import { Practicer } from '../practice/Practicer';
import { StepNav } from './components/StepNav';
import { StorageNotice } from './components/StorageNotice';
import { STEP_INFO } from './lessonSteps';
import { CheckStep } from './steps/CheckStep';
import { LearnStep } from './steps/LearnStep';
import { ListenStep } from './steps/ListenStep';
import { useCourseProgress } from './useCourseProgress';

function StepContent({ lesson, step }: { lesson: Lesson; step: LessonStep }) {
  switch (step) {
    case 'learn':
      return <LearnStep lesson={lesson} />;
    case 'listen':
      return <ListenStep lesson={lesson} />;
    case 'practice':
      return <Practicer exercise={lesson.exercise} />;
    case 'check':
      return <CheckStep lesson={lesson} />;
  }
}

export function LessonScreen() {
  const { lessonId = '', step } = useParams();
  const lesson = findLesson(lessonId);
  const progress = useCourseProgress();

  if (!lesson) {
    return (
      <Screen title="Lesson not found" backTo={LEARN_PATH} backLabel="Learn">
        <EmptyState
          icon={BookOpen}
          title="No such lesson"
          description="This lesson doesn’t exist. It may have been renamed or removed."
          action={<ButtonLink to={LEARN_PATH}>All stages</ButtonLink>}
        />
      </Screen>
    );
  }
  if (!isLessonStep(step)) return <Navigate to={lessonPath(lesson.id)} replace />;

  const stage = findStage(lesson.stageId);
  const unit = stage?.units.find((candidate) => candidate.id === lesson.unitId);
  const number = (stage?.lessons.indexOf(lesson) ?? 0) + 1;
  const state = progress.lessons.get(lesson.id);
  const back = { backTo: stagePath(lesson.stageId), backLabel: `Stage ${stage?.number ?? ''}` };

  if (!state || state.status === 'locked') {
    const index = COURSE.lessons.indexOf(lesson);
    const previous = COURSE.lessons[index - 1];
    return (
      <Screen title={lesson.title} {...back}>
        <EmptyState
          icon={Lock}
          title="This lesson is locked"
          description={
            previous?.stageId === lesson.stageId
              ? `Pass “${previous.title}” to unlock it.`
              : `Complete Stage ${(stage?.number ?? 1) - 1} to unlock it.`
          }
          action={
            progress.next ? (
              <ButtonLink to={lessonPath(progress.next.id)}>
                Go to “{progress.next.title}”
              </ButtonLink>
            ) : undefined
          }
        />
      </Screen>
    );
  }

  const nextStep = LESSON_STEPS[LESSON_STEPS.indexOf(step) + 1];
  return (
    <Screen title={lesson.title} {...back}>
      <StorageNotice />
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Stage {stage?.number} · Lesson {number} of {stage?.lessons.length}
          {unit && <span className="block">{unit.title}</span>}
        </p>
        {state.stars > 0 && <StarRating stars={state.stars} />}
      </div>
      <StepNav lessonId={lesson.id} current={step} />
      <div className="mt-4">
        {/* Keyed by lesson and step: each step gets a fresh session. */}
        <StepContent key={`${lesson.id}:${step}`} lesson={lesson} step={step} />
      </div>
      {nextStep && (
        <ButtonLink
          to={lessonPath(lesson.id, nextStep)}
          replace
          variant="secondary"
          size="lg"
          fullWidth
          icon={ArrowRight}
          className="mt-6"
        >
          Next: {STEP_INFO[nextStep].label}
        </ButtonLink>
      )}
    </Screen>
  );
}
