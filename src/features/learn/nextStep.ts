import { lessonPath, stageTestPath } from '@/app/navigation';
import type { NextStep } from './progression';

/** Where a "carry on" link goes and what it says. */
export function describeNextStep(step: NextStep): {
  path: string;
  title: string;
  summary: string;
  stageId: string;
} {
  if (step.kind === 'lesson') {
    const { lesson } = step;
    return {
      path: lessonPath(lesson.id),
      title: lesson.title,
      summary: lesson.summary,
      stageId: lesson.stageId,
    };
  }
  return {
    path: stageTestPath(step.stage.id),
    title: step.test.title,
    summary: step.test.summary,
    stageId: step.stage.id,
  };
}
