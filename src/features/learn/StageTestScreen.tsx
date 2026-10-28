import { ArrowRight, ClipboardCheck, Lock, Mic, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { LEARN_PATH, stagePath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { findStage, type Stage, type StageTest, type StageTestPart } from '@/content/course';
import { useProgressStore } from '@/stores/progressStore';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { StarRating } from '@/ui/StarRating';
import { STAR_THRESHOLDS } from '../practice/scoring/stars';
import type { SessionSummary } from '../practice/scoring/summary';
import { AudioUnsupported } from './components/AudioUnsupported';
import { CalibrationHint } from './components/CalibrationHint';
import { ScoredRunView } from './components/ScoredRunView';
import { StorageNotice } from './components/StorageNotice';
import { percent } from './format';
import { describeNextStep } from './nextStep';
import { stageTestResult } from './stageTestResult';
import { useCourseProgress } from './useCourseProgress';
import { useScoredRun } from './useScoredRun';

function Intro({ stage, test, onStart }: { stage: Stage; test: StageTest; onStart: () => void }) {
  const best = useProgressStore((state) => state.lessons[test.id]);
  return (
    <div className="space-y-4">
      <Card className="space-y-3 text-sm text-pretty">
        <p className="text-base">{test.summary}</p>
        <p className="flex gap-2">
          <Mic aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
          <span>
            Play each part once with the click. Your score is the accuracy over all of them:{' '}
            {percent(STAR_THRESHOLDS[0])} passes and opens Stage {stage.number + 1}.
          </span>
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
      <ol className="space-y-2" aria-label="Parts">
        {test.parts.map((part, i) => (
          <li
            key={part.exercise.id}
            className="flex items-center gap-3 rounded-card border border-border bg-surface p-3"
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-bold"
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 font-semibold">{part.title}</span>
            <span className="text-xs text-fg-muted tabular-nums">
              {part.exercise.bars.length} bars · {part.exercise.tempo} BPM
            </span>
          </li>
        ))}
      </ol>
      <Button size="lg" fullWidth icon={ClipboardCheck} onClick={onStart}>
        Start the test
      </Button>
    </div>
  );
}

function PartRun({
  test,
  index,
  part,
  onDone,
}: {
  test: StageTest;
  index: number;
  part: StageTestPart;
  onDone: (summary: SessionSummary) => void;
}) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const run = useScoredRun(part.exercise, { mode: 'stageTest', lessonId: test.id }, setSummary);
  if (run.session.error === 'audio-unsupported') return <AudioUnsupported />;
  const last = index === test.parts.length - 1;
  return (
    <section aria-labelledby="part-heading" className="space-y-3">
      <h2 id="part-heading" className="font-semibold">
        <span className="text-fg-muted">
          Part {index + 1} of {test.parts.length} ·
        </span>{' '}
        {part.title}
      </h2>
      {summary ? (
        <Card role="status" className="space-y-3 text-center">
          <p className="text-3xl font-bold tabular-nums">{percent(summary.accuracy)}</p>
          <p className="text-sm text-fg-muted">accuracy on this part</p>
          <Button
            size="lg"
            fullWidth
            icon={ArrowRight}
            onClick={() => {
              onDone(summary);
            }}
          >
            {last ? 'See your result' : 'Next part'}
          </Button>
        </Card>
      ) : (
        <ScoredRunView run={run} onRestart={run.restart} />
      )}
    </section>
  );
}

function Result({
  stage,
  test,
  parts,
  onRetry,
}: {
  stage: Stage;
  test: StageTest;
  parts: readonly SessionSummary[];
  onRetry: () => void;
}) {
  const result = stageTestResult(parts);
  const progress = useCourseProgress();
  const next = progress.next ? describeNextStep(progress.next) : null;
  return (
    <Card role="status" className="space-y-4 text-center">
      <StarRating stars={result.stars} size="lg" className="justify-center" />
      <div>
        <p className="text-4xl font-bold tabular-nums">{percent(result.accuracy)}</p>
        <p className="text-sm text-fg-muted">accuracy over {parts.length} parts</p>
      </div>
      <p className="text-lg font-semibold text-pretty">
        {result.passed
          ? `Stage ${stage.number} passed! You’re now ${progress.level.name}.`
          : `Not yet: ${percent(STAR_THRESHOLDS[0])} passes. Practise the stage’s lessons, then try again.`}
      </p>
      <ul className="space-y-1 text-sm">
        {test.parts.map((part, i) => (
          <li key={part.exercise.id} className="flex justify-between gap-3">
            <span className="text-fg-muted">{part.title}</span>
            <span className="font-semibold tabular-nums">
              {parts[i] ? percent(parts[i].accuracy) : '–'}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-2">
        {result.passed && next ? (
          <ButtonLink to={next.path} size="lg" icon={ArrowRight}>
            {next.title}
          </ButtonLink>
        ) : (
          <ButtonLink to={stagePath(stage.id)} size="lg">
            Back to Stage {stage.number}
          </ButtonLink>
        )}
        <Button variant="secondary" icon={RotateCcw} onClick={onRetry}>
          Take it again
        </Button>
      </div>
    </Card>
  );
}

type Phase = { kind: 'intro' } | { kind: 'part'; index: number } | { kind: 'result' };

export function StageTestScreen() {
  const { stageId = '' } = useParams();
  const stage = findStage(stageId);
  const progress = useCourseProgress();
  const recordAttempt = useProgressStore((state) => state.recordAttempt);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [parts, setParts] = useState<readonly SessionSummary[]>([]);
  const test = stage?.test;
  const state = stage ? progress.stages.get(stage.id)?.test : undefined;

  const partDone = (summary: SessionSummary) => {
    if (!test || phase.kind !== 'part') return;
    const done = [...parts, summary];
    setParts(done);
    if (phase.index + 1 < test.parts.length) {
      setPhase({ kind: 'part', index: phase.index + 1 });
      return;
    }
    const result = stageTestResult(done);
    void recordAttempt(test.id, {
      accuracy: Math.min(1, Math.max(0, result.accuracy)),
      stars: result.stars,
    });
    setPhase({ kind: 'result' });
  };

  if (!stage || !test || !state) {
    return (
      <Screen title="Test not found" backTo={LEARN_PATH} backLabel="Learn">
        <EmptyState
          icon={ClipboardCheck}
          title="No such stage test"
          description="This stage has no test yet."
          action={<ButtonLink to={LEARN_PATH}>All stages</ButtonLink>}
        />
      </Screen>
    );
  }
  const back = { backTo: stagePath(stage.id), backLabel: `Stage ${stage.number}` };
  const currentPart = phase.kind === 'part' ? test.parts[phase.index] : undefined;
  if (state.status === 'locked') {
    return (
      <Screen title={test.title} {...back}>
        <EmptyState
          icon={Lock}
          title="This test is locked"
          description={`Complete every lesson in Stage ${stage.number} to take its test.`}
          action={<ButtonLink to={stagePath(stage.id)}>Go to Stage {stage.number}</ButtonLink>}
        />
      </Screen>
    );
  }
  return (
    <Screen title={test.title} {...back}>
      <StorageNotice />
      {phase.kind === 'intro' && (
        <Intro
          stage={stage}
          test={test}
          onStart={() => {
            setParts([]);
            setPhase({ kind: 'part', index: 0 });
          }}
        />
      )}
      {phase.kind === 'part' && currentPart && (
        // Keyed by part: each part gets a fresh session.
        <PartRun
          key={phase.index}
          test={test}
          index={phase.index}
          part={currentPart}
          onDone={partDone}
        />
      )}
      {phase.kind === 'result' && (
        <Result
          stage={stage}
          test={test}
          parts={parts}
          onRetry={() => {
            setParts([]);
            setPhase({ kind: 'part', index: 0 });
          }}
        />
      )}
    </Screen>
  );
}
