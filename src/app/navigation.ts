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

export const HOME_PATH = '/tuner';

export const PRACTICE_PATH = '/practice';

export function exercisePath(exerciseId: string): string {
  return `${PRACTICE_PATH}/${encodeURIComponent(exerciseId)}`;
}

export const SETTINGS_PATH = '/profile/settings';
export const LATENCY_PATH = `${SETTINGS_PATH}/latency`;
