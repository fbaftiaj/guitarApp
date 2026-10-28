import { CircleUser, Gauge, GraduationCap, Guitar, ListMusic, type LucideIcon } from 'lucide-react';

export interface TabDefinition {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Primary destinations, in tab-bar order. */
export const TABS: readonly TabDefinition[] = [
  { to: '/tuner', label: 'Tuner', icon: Gauge },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
  { to: '/practice', label: 'Practice', icon: Guitar },
  { to: '/songs', label: 'Songs', icon: ListMusic },
  { to: '/profile', label: 'Profile', icon: CircleUser },
];

export const TUNER_PATH = '/tuner';
export const HOME_PATH = TUNER_PATH;
/** First-launch setup. */
export const WELCOME_PATH = '/welcome';

export const LEARN_PATH = '/learn';

export function stagePath(stageId: string): string {
  return `${LEARN_PATH}/stage/${encodeURIComponent(stageId)}`;
}

export function stageTestPath(stageId: string): string {
  return `${stagePath(stageId)}/test`;
}

/** A lesson's steps, in order. */
export const LESSON_STEPS = ['learn', 'listen', 'practice', 'check'] as const;
export type LessonStep = (typeof LESSON_STEPS)[number];

export function isLessonStep(value: string | undefined): value is LessonStep {
  return LESSON_STEPS.some((step) => step === value);
}

export function lessonPath(lessonId: string, step: LessonStep = 'learn'): string {
  return `${LEARN_PATH}/lesson/${encodeURIComponent(lessonId)}/${step}`;
}

export const PRACTICE_PATH = '/practice';

export const TRAINER_PATH = '/trainer';

/** The chord trainer for `chords`; `learn` goes string by string first; `back` is where Close goes. */
export function trainerPath({
  chords,
  learn,
  back,
}: {
  chords: readonly string[];
  learn: boolean;
  back?: string;
}): string {
  const params = new URLSearchParams({ chords: chords.join(','), learn: learn ? '1' : '0' });
  if (back) params.set('back', back);
  return `${TRAINER_PATH}?${params.toString()}`;
}

const SAME_ORIGIN = 'https://app.invalid';

/**
 * Only app paths are followed: anything that resolves to another site ("//host",
 * "/\\host", tabs or newlines the URL parser drops) falls back.
 */
export function safeAppPath(path: string | null, fallback: string): string {
  if (!path?.startsWith('/')) return fallback;
  try {
    const url = new URL(path, SAME_ORIGIN);
    return url.origin === SAME_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function exercisePath(exerciseId: string): string {
  return `${PRACTICE_PATH}/${encodeURIComponent(exerciseId)}`;
}

export const SONGS_PATH = '/songs';

export function songPath(songId: string): string {
  return `${SONGS_PATH}/${encodeURIComponent(songId)}`;
}

export const PROFILE_PATH = '/profile';
export const CHORD_LIBRARY_PATH = `${PROFILE_PATH}/chords`;

export function chordPath(chordId: string): string {
  return `${CHORD_LIBRARY_PATH}/${encodeURIComponent(chordId)}`;
}

export const SETTINGS_PATH = '/profile/settings';
export const LATENCY_PATH = `${SETTINGS_PATH}/latency`;
