import { COURSE } from '@/content/course';

/** The setup question "How much have you played?" and where each answer starts the course. */
export const EXPERIENCE = [
  { value: 'new', label: 'I’ve never played', stage: 1 },
  { value: 'some', label: 'I know a few chords', stage: 2 },
  { value: 'regular', label: 'I play regularly', stage: 3 },
] as const;

export type Experience = (typeof EXPERIENCE)[number]['value'];

export function startStageFor(experience: Experience): number {
  return EXPERIENCE.find((choice) => choice.value === experience)?.stage ?? 1;
}

/** "Start at Stage 2: Open Chords I" */
export function placementText(experience: Experience): string {
  const number = startStageFor(experience);
  const stage = COURSE.stages.find((candidate) => candidate.number === number);
  return `Start at Stage ${number}${stage ? `: ${stage.title}` : ''}`;
}
