import { ChevronRight, Clock, Flame, GraduationCap, Library, Settings } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { CHORD_LIBRARY_PATH, LEARN_PATH, SETTINGS_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { COURSE } from '@/content/course';
import { ALL_EXERCISES } from '@/content/exerciseIndex';
import { localDay } from '@/lib/time/localDay';
import { useToday } from '@/platform/useToday';
import { useActivityStore } from '@/stores/activityStore';
import { useProgressStore } from '@/stores/progressStore';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { ErrorState } from '@/ui/ErrorState';
import { IconLink } from '@/ui/IconLink';
import { LoadingState } from '@/ui/LoadingState';
import { StorageNotice } from '../learn/components/StorageNotice';
import { useCourseProgress } from '../learn/useCourseProgress';
import { AccuracyChart } from './components/AccuracyChart';
import { SkillMeters } from './components/SkillMeters';
import { learnedChords } from './learnedChords';
import { accuracyHistory, practiceMinutes, practiceStreak, skillMeters } from './stats';
import { useRecentSessions } from './useRecentSessions';

const targetTempo = (exerciseId: string) => ALL_EXERCISES.get(exerciseId)?.tempo;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
        <Icon aria-hidden className="size-4 text-accent-text" />
        {label}
      </dt>
      <dd className="mt-1">
        <span className="block text-2xl font-bold">{value}</span>
        <span className="text-xs text-fg-muted">{detail}</span>
      </dd>
    </div>
  );
}

export function ProfileScreen() {
  const progress = useCourseProgress();
  const lessons = useProgressStore((state) => state.lessons);
  const days = useActivityStore((state) => state.days);
  const sessions = useRecentSessions();
  const today = useToday();

  const streak = practiceStreak(days, today);
  const minutes = practiceMinutes(days, today);
  const chords = useMemo(() => learnedChords(COURSE, lessons), [lessons]);
  const completed = COURSE.lessons.filter(
    (lesson) => progress.lessons.get(lesson.id)?.status === 'completed',
  ).length;
  const { level } = progress;
  // Stages are passed in order, so the next one to pass follows the passed ones.
  const nextStage = COURSE.stages[progress.stagesPassed];
  const nextTest = nextStage?.test ? nextStage : undefined;

  return (
    <Screen
      title="Profile"
      actions={<IconLink to={SETTINGS_PATH} icon={Settings} label="Settings" className="-mr-2" />}
    >
      <StorageNotice />
      <Card className="mb-4">
        <p className="text-xs font-semibold tracking-wide text-accent-text uppercase">Your level</p>
        <p className="mt-1 text-3xl font-bold">{level.name}</p>
        <p className="mt-1 text-sm text-pretty text-fg-muted">
          {level.next && nextTest
            ? `Pass the Stage ${nextTest.number} test to ${
                level.next.testsNeeded === 1
                  ? `reach ${level.next.name}`
                  : `get closer to ${level.next.name}`
              }.`
            : level.next
              ? `New stages are on their way to take you to ${level.next.name}.`
              : 'You’ve reached the top level. Keep playing to keep your skills sharp.'}
        </p>
        <p className="mt-3 text-sm">
          <span className="font-semibold">{plural(completed, 'lesson')}</span>
          <span className="text-fg-muted"> of {COURSE.lessons.length} completed · </span>
          <span className="font-semibold">{plural(progress.stagesPassed, 'stage')}</span>
          <span className="text-fg-muted"> passed</span>
        </p>
        {completed === 0 && (
          <ButtonLink to={LEARN_PATH} icon={GraduationCap} fullWidth className="mt-4">
            Start your first lesson
          </ButtonLink>
        )}
      </Card>

      <dl className="mb-4 grid grid-cols-2 gap-3">
        <StatTile
          icon={Flame}
          label="Practice streak"
          value={plural(streak.current, 'day')}
          detail={
            streak.practisedToday
              ? `Longest ${plural(streak.longest, 'day')}`
              : streak.current > 0
                ? 'Play today to keep it going'
                : 'Play a minute to start one'
          }
        />
        <StatTile
          icon={Clock}
          label="Practice time"
          value={`${minutes.total} min`}
          detail={`${minutes.week} min in the last 7 days`}
        />
      </dl>

      {sessions.status === 'loading' && <LoadingState label="Loading your results…" />}
      {sessions.status === 'error' && (
        <ErrorState
          title="Your results couldn’t be loaded"
          description="Skill meters and history need the browser’s storage. Reload to try again."
        />
      )}
      {sessions.status === 'ready' && (
        <>
          <Card className="mb-4">
            <h2 className="font-semibold">Skills</h2>
            <p className="mb-4 text-sm text-fg-muted">
              From your recent scored playing: newer sessions count more, and playing below the
              target tempo earns part of the credit.
            </p>
            <SkillMeters meters={skillMeters(sessions.sessions, targetTempo)} />
          </Card>
          <Card className="mb-4">
            <h2 className="font-semibold">Accuracy, last 30 days</h2>
            <p className="mb-3 text-sm text-fg-muted">Every scored session, averaged by day.</p>
            <AccuracyChart days={accuracyHistory(sessions.sessions, today, localDay)} />
          </Card>
        </>
      )}

      <Link
        to={CHORD_LIBRARY_PATH}
        className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
      >
        <Library aria-hidden className="size-6 shrink-0 text-accent-text" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Chord library</span>
          <span className="block text-sm text-fg-muted">
            {chords.length === 0
              ? 'Chords you learn appear here'
              : `${plural(chords.length, 'chord')} learned`}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />
      </Link>
    </Screen>
  );
}
