import { ArrowRight, Mic, RotateCcw, Timer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LATENCY_PATH, lessonPath, stagePath } from '@/app/navigation';
import { COURSE, type Lesson } from '@/content/course';
import { useWakeLock } from '@/platform/useWakeLock';
import { useProgressStore } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { ErrorState } from '@/ui/ErrorState';
import { StarRating } from '@/ui/StarRating';
import { HitCounts } from '../../practice/components/HitCounts';
import { MicrophoneAlert } from '../../practice/components/MicrophoneAlert';
import { PlayAlong } from '../../practice/components/PlayAlong';
import { TransportControls } from '../../practice/components/TransportControls';
import { arrange } from '../../practice/engine/arrangement';
import { compileExercise } from '../../practice/engine/timeline';
import { usePracticeListening } from '../../practice/listening/usePracticeListening';
import { usePracticeStore } from '../../practice/practiceStore';
import { playThroughSettings } from '../../practice/practiceView';
import { STAR_THRESHOLDS } from '../../practice/scoring/stars';
import type { SessionSummary } from '../../practice/scoring/summary';
import { usePracticeSession } from '../../practice/usePracticeSession';
import { lessonAfter } from '../progression';
import { useCourseProgress } from '../useCourseProgress';

/** Results wait this long after the end, for the last strums' checks to come in. */
const RESULTS_DELAY_MS = 400;
const keepTempo = () => undefined;
const percent = (value: number) => `${Math.round(value * 100)}%`;

function CheckResult({
  lesson,
  summary,
  onRetry,
}: {
  lesson: Lesson;
  summary: SessionSummary;
  onRetry: () => void;
}) {
  const progress = useCourseProgress();
  const next = lessonAfter(COURSE, lesson.id);
  const nextOpen = next !== null && progress.lessons.get(next.id)?.status !== 'locked';
  const passed = summary.stars > 0;
  return (
    <Card role="status" className="space-y-4 text-center">
      <StarRating stars={summary.stars} size="lg" className="justify-center" />
      <div>
        <p className="text-4xl font-bold tabular-nums">{percent(summary.accuracy)}</p>
        <p className="text-sm text-fg-muted">accuracy</p>
      </div>
      <p className="text-lg font-semibold text-pretty">
        {passed
          ? next && nextOpen
            ? `Passed! “${next.title}” is unlocked.`
            : 'Passed!'
          : `Not yet: ${percent(STAR_THRESHOLDS[0])} passes. Keep practising, then try again.`}
      </p>
      <HitCounts summary={summary} />
      <div className="grid gap-2">
        {passed && next && nextOpen ? (
          <ButtonLink to={lessonPath(next.id)} size="lg" icon={ArrowRight}>
            Next lesson
          </ButtonLink>
        ) : passed ? (
          <ButtonLink to={stagePath(lesson.stageId)} size="lg">
            Back to the stage
          </ButtonLink>
        ) : (
          <ButtonLink to={lessonPath(lesson.id, 'practice')} size="lg">
            Practise more
          </ButtonLink>
        )}
        <Button variant="secondary" icon={RotateCcw} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

/**
 * The scored run that passes a lesson: the whole exercise at its target
 * tempo, listened to through the microphone. The guide stays silent so the
 * microphone hears only the player.
 */
export function CheckStep({ lesson }: { lesson: Lesson }) {
  const { exercise } = lesson;
  const timeline = useMemo(() => compileExercise(exercise), [exercise]);
  const events = useMemo(() => arrange(timeline), [timeline]);
  const settings = useMemo(() => playThroughSettings(exercise.tempo), [exercise.tempo]);
  const mix = usePracticeStore((state) => state.mix);
  const labels = usePracticeStore((state) => state.labels);
  const fretboard = usePracticeStore((state) => state.fretboard);
  const a4 = useSettingsStore((state) => state.referencePitch);
  const latencyMs = useSettingsStore((state) => state.latencyMs);
  const best = useProgressStore((state) => state.lessons[lesson.id]);
  const recordAttempt = useProgressStore((state) => state.recordAttempt);
  const checkMix = useMemo(() => ({ ...mix, guide: { ...mix.guide, enabled: false } }), [mix]);

  const listening = usePracticeListening({
    timeline,
    exercise,
    enabled: true,
    waitMode: false,
    a4,
    latencyMs,
  });
  const session = usePracticeSession({
    timeline,
    events,
    settings,
    mix: checkMix,
    a4,
    onTempoChange: keepTempo,
    input: listening.input,
  });
  const { view } = session;
  useWakeLock(view.phase === 'countIn' || view.phase === 'playing');

  const [result, setResult] = useState<SessionSummary | null>(null);
  const { finish, reset: resetListening, clearError } = listening;
  useEffect(() => {
    if (view.phase !== 'finished') return;
    const timer = window.setTimeout(() => {
      const summary = finish(exercise.tempo, { mode: 'check', lessonId: lesson.id });
      resetListening();
      if (!summary) return;
      setResult(summary);
      void recordAttempt(lesson.id, {
        accuracy: Math.min(1, Math.max(0, summary.accuracy)),
        stars: summary.stars,
        at: Date.now(),
      });
    }, RESULTS_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [exercise.tempo, finish, lesson.id, recordAttempt, resetListening, view.phase]);

  const { restart } = session;
  const restartCheck = useCallback(() => {
    restart();
    resetListening();
    setResult(null);
  }, [resetListening, restart]);
  const play = useCallback(() => {
    clearError();
    setResult(null);
    session.play();
  }, [clearError, session]);

  if (session.error === 'audio-unsupported') {
    return (
      <ErrorState
        title="Audio isn’t available"
        description="This browser can’t play the click track. Try a recent Chrome, Edge, Firefox or Safari."
      />
    );
  }
  return (
    <section aria-label="Check" className="space-y-3">
      {result ? (
        <CheckResult lesson={lesson} summary={result} onRetry={restartCheck} />
      ) : (
        <Card className="space-y-2 text-sm text-pretty">
          <p className="flex gap-2">
            <Mic aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
            <span>
              Play it all the way through with the click at {exercise.tempo} BPM. FretPath listens
              and scores every {exercise.kind === 'chords' ? 'strum' : 'note'}.
            </span>
          </p>
          <p className="text-fg-muted">
            {percent(STAR_THRESHOLDS[0])} passes with one star and unlocks the next lesson;{' '}
            {percent(STAR_THRESHOLDS[1])} earns two stars and {percent(STAR_THRESHOLDS[2])} three.
          </p>
          {best && best.attempts > 0 && (
            <p className="flex items-center gap-2">
              <span className="font-semibold">Your best:</span>
              <StarRating stars={best.stars} size="sm" />
              <span className="text-fg-muted">{percent(best.bestAccuracy)}</span>
            </p>
          )}
          {latencyMs === null && (
            <p className="flex items-center justify-between gap-3 text-fg-muted">
              <span>Timing isn’t calibrated yet, so scores may be a little off.</span>
              <ButtonLink to={LATENCY_PATH} variant="ghost" icon={Timer} className="-mr-2 shrink-0">
                Calibrate
              </ButtonLink>
            </p>
          )}
        </Card>
      )}

      {listening.error && <MicrophoneAlert error={listening.error} onRetry={play} />}

      <PlayAlong
        timeline={timeline}
        session={session}
        tempo={exercise.tempo}
        loop={null}
        loops={false}
        labels={labels}
        fretboard={fretboard}
        feedback={listening.feedback}
        scoring
      />
      {session.error === 'audio-blocked' && (
        <p role="alert" className="text-center text-sm text-warning">
          The browser didn’t start the sound. Tap Play again.
        </p>
      )}
      <TransportControls
        phase={view.phase}
        starting={session.starting}
        waitMode={false}
        onPlay={play}
        onPause={session.pause}
        onRestart={restartCheck}
        onNext={session.next}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {view.phase === 'countIn' ? 'Count-in' : view.phase === 'playing' ? 'Listening' : ''}
      </p>
    </section>
  );
}
