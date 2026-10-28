import { ArrowRight, Mic, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { lessonPath, stagePath } from '@/app/navigation';
import { COURSE, type Lesson } from '@/content/course';
import { useProgressStore } from '@/stores/progressStore';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { StarRating } from '@/ui/StarRating';
import { HitCounts } from '../../practice/components/HitCounts';
import { STAR_THRESHOLDS } from '../../practice/scoring/stars';
import type { SessionSummary } from '../../practice/scoring/summary';
import { AudioUnsupported } from '../components/AudioUnsupported';
import { CalibrationHint } from '../components/CalibrationHint';
import { ScoredRunView } from '../components/ScoredRunView';
import { percent } from '../format';
import { describeNextStep } from '../nextStep';
import { lessonAfter } from '../progression';
import { useCourseProgress } from '../useCourseProgress';
import { useScoredRun } from '../useScoredRun';

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
  // The last lesson of a stage leads to the stage test.
  const test = progress.next?.kind === 'test' ? describeNextStep(progress.next) : null;
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
            : test
              ? `Passed! The ${test.title.toLowerCase()} is open.`
              : 'Passed!'
          : `Not yet: ${percent(STAR_THRESHOLDS[0])} passes. Keep practising, then try again.`}
      </p>
      <HitCounts summary={summary} />
      <div className="grid gap-2">
        {passed && next && nextOpen ? (
          <ButtonLink to={lessonPath(next.id)} size="lg" icon={ArrowRight}>
            Next lesson
          </ButtonLink>
        ) : passed && test ? (
          <ButtonLink to={test.path} size="lg" icon={ArrowRight}>
            Take the stage test
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
 * tempo, listened to through the microphone.
 */
export function CheckStep({ lesson }: { lesson: Lesson }) {
  const { exercise } = lesson;
  const best = useProgressStore((state) => state.lessons[lesson.id]);
  const recordAttempt = useProgressStore((state) => state.recordAttempt);
  const [result, setResult] = useState<SessionSummary | null>(null);
  const onResult = useCallback(
    (summary: SessionSummary) => {
      setResult(summary);
      void recordAttempt(lesson.id, {
        accuracy: Math.min(1, Math.max(0, summary.accuracy)),
        stars: summary.stars,
      });
    },
    [lesson.id, recordAttempt],
  );
  const run = useScoredRun(exercise, { mode: 'check', lessonId: lesson.id }, onResult);
  const { restart, play } = run;
  const restartCheck = useCallback(() => {
    restart();
    setResult(null);
  }, [restart]);
  const playCheck = useCallback(() => {
    setResult(null);
    play();
  }, [play]);

  if (run.session.error === 'audio-unsupported') return <AudioUnsupported />;
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
          <CalibrationHint />
        </Card>
      )}
      <ScoredRunView run={{ ...run, play: playCheck }} onRestart={restartCheck} />
    </section>
  );
}
