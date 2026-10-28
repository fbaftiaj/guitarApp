import { BookOpen, CircleCheck, Ear, Repeat, type LucideIcon } from 'lucide-react';
import type { LessonStep } from '@/app/navigation';

export const STEP_INFO: Record<LessonStep, { label: string; icon: LucideIcon }> = {
  learn: { label: 'Learn', icon: BookOpen },
  listen: { label: 'Listen', icon: Ear },
  practice: { label: 'Practice', icon: Repeat },
  check: { label: 'Check', icon: CircleCheck },
};
