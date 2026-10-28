import { CircleCheck, Mic, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { PRACTICE_PATH, safeAppPath, trainerPath } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { CHORDS } from '@/content/chords';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { cx } from '@/ui/cx';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { BigChordDiagram } from '../practice/components/BigChordDiagram';
import { MicrophoneAlert } from '../practice/components/MicrophoneAlert';
import { MicLevel } from './components/MicLevel';
import { StepProgress } from './components/StepProgress';
import { nextChordAfter, trainerPlan, type TrainerStep } from './trainerPlan';
import { feedbackText, instruction } from './trainerText';
import { useTrainer } from './useTrainer';

function title(chords: readonly string[]): string {
  const names = chords.map((id) => CHORDS.get(id)?.id ?? id);
  return names.length <= 1 ? `Learn ${names[0] ?? 'a chord'}` : names.join(' – ');
}

/** Strings of the current chord already played right in this learning section. */
function doneStrings(plan: readonly TrainerStep[], index: number): Set<number> {
  const current = plan[index];
  const done = new Set<number>();
  if (!current || current.kind === 'change') return done;
  for (let i = index - 1; i >= 0; i--) {
    const step = plan[i];
    if (step?.kind !== 'string' || step.chordId !== current.chordId) break;
    done.add(step.string);
  }
  if (current.kind === 'strum') {
    CHORDS.get(current.chordId)?.midis.forEach((midi, i) => {
      if (midi !== null) done.add(6 - i);
    });
  }
  return done;
}

function Summary({
  chords,
  changeSeconds,
  mistakes,
  learned,
  onAgain,
  back,
}: {
  chords: readonly string[];
  changeSeconds: readonly number[];
  mistakes: number;
  learned: boolean;
  onAgain: () => void;
  back: string;
}) {
  const average =
    changeSeconds.length > 0
      ? changeSeconds.reduce((sum, seconds) => sum + seconds, 0) / changeSeconds.length
      : null;
  return (
    <Card role="status" className="space-y-4 text-center">
      <CircleCheck aria-hidden className="mx-auto size-12 text-accent-text" />
      <p className="text-xl font-bold">Well played!</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {average !== null && (
          <div className="rounded-control bg-surface-raised p-3">
            <dt className="text-fg-muted">Average change</dt>
            <dd className="text-2xl font-bold">{average.toFixed(1)} s</dd>
          </div>
        )}
        <div
          className={cx('rounded-control bg-surface-raised p-3', average === null && 'col-span-2')}
        >
          <dt className="text-fg-muted">Tries that missed</dt>
          <dd className="text-2xl font-bold">{mistakes}</dd>
        </div>
      </dl>
      <div className="grid gap-2">
        {chords.length >= 2 && learned && (
          <ButtonLink to={trainerPath({ chords, learn: false, back })} size="lg" icon={RotateCcw}>
            Practise the changes again
          </ButtonLink>
        )}
        <Button
          variant={chords.length >= 2 && learned ? 'secondary' : 'primary'}
          size="lg"
          icon={RotateCcw}
          onClick={onAgain}
        >
          Start over
        </Button>
        <ButtonLink to={back} variant="ghost">
          Done
        </ButtonLink>
      </div>
    </Card>
  );
}

function Trainer({
  chords,
  learn,
  back,
}: {
  chords: readonly string[];
  learn: boolean;
  back: string;
}) {
  const a4 = useSettingsStore((state) => state.referencePitch);
  const plan = useMemo(() => trainerPlan({ chords, learn }), [chords, learn]);
  const trainer = useTrainer(plan, a4);
  const { state, microphone, finished } = trainer;
  const step = plan[state.step];
  const chord = step ? CHORDS.get(step.chordId) : undefined;
  const nextId = nextChordAfter(plan, state.step);
  const next = nextId ? CHORDS.get(nextId) : undefined;
  const listening = microphone.status !== 'idle';

  if (microphone.error === 'audio-unsupported') {
    return (
      <ErrorState
        title="Audio isn’t available"
        description="This browser can’t use the microphone. Try a recent Chrome, Edge, Firefox or Safari."
      />
    );
  }
  if (finished) {
    return (
      <Summary
        chords={chords}
        changeSeconds={state.changeSeconds}
        mistakes={state.mistakes}
        learned={learn}
        back={back}
        onAgain={() => {
          trainer.restart();
          microphone.start();
        }}
      />
    );
  }
  if (!step || !chord) return null;

  const { title: heading, detail } = instruction(step);
  const feedback = state.feedback;
  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-5">
      <StepProgress plan={plan} step={state.step} />

      <div className="text-center">
        <p className="text-2xl font-bold text-balance">{heading}</p>
        <p className="mt-1 text-sm text-pretty text-fg-muted">{detail}</p>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4">
        <div className="flex w-full max-w-64 flex-col items-center">
          <BigChordDiagram
            chord={chord}
            activeString={step.kind === 'string' ? step.string : null}
            doneStrings={doneStrings(plan, state.step)}
          />
          <p className="mt-2 text-3xl font-bold">{chord.id}</p>
          {step.kind === 'strum' && (
            <ol aria-label={`${state.strums} of ${step.needed} strums`} className="mt-2 flex gap-2">
              {Array.from({ length: step.needed }, (_, i) => (
                <li
                  key={i}
                  className={cx(
                    'flex size-8 items-center justify-center rounded-full border-2',
                    i < state.strums
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border-strong text-fg-subtle',
                  )}
                >
                  <CircleCheck aria-hidden className="size-5" />
                </li>
              ))}
            </ol>
          )}
        </div>
        {next && (
          <div className="flex w-24 shrink-0 flex-col items-center">
            <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Next</p>
            <BigChordDiagram chord={next} size="sm" />
            <p className="text-lg font-semibold text-fg-muted">{next.id}</p>
          </div>
        )}
      </div>

      <p
        role="status"
        key={feedback?.attempt}
        className={cx(
          'min-h-12 text-center font-semibold text-pretty',
          feedback?.correct ? 'text-accent-text motion-safe:animate-pop-in' : 'text-warning',
        )}
      >
        {feedback ? feedbackText(feedback) : ''}
      </p>

      {microphone.error ? (
        <MicrophoneAlert error={microphone.error} onRetry={microphone.start} />
      ) : (
        <div className="space-y-3">
          {listening ? (
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <Button variant="secondary" size="lg" icon={Square} onClick={microphone.stop}>
                Pause
              </Button>
              <Button variant="ghost" size="lg" icon={SkipForward} onClick={trainer.skip}>
                Skip
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              fullWidth
              icon={state.attempts > 0 ? Play : Mic}
              onClick={microphone.start}
            >
              {state.attempts > 0 ? 'Carry on' : 'Start listening'}
            </Button>
          )}
          <div className="flex justify-center">
            <MicLevel status={microphone.status} subscribe={trainer.subscribeLevel} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The chord trainer: learn chords string by string, strum them, then change
 * between them at your own pace. It listens all the time and only moves on
 * when it hears the right string or chord: there is no metronome.
 */
export function TrainerScreen() {
  const [params] = useSearchParams();
  const chords = useMemo(
    () =>
      (params.get('chords') ?? '')
        .split(',')
        .filter((id) => CHORDS.has(id))
        .slice(0, 6),
    [params],
  );
  const learn = params.get('learn') !== '0';
  const back = safeAppPath(params.get('back'), PRACTICE_PATH);

  if (chords.length === 0) {
    return (
      <Screen title="Chord trainer" backTo={back} backLabel="Close">
        <EmptyState
          icon={Mic}
          title="No chords chosen"
          description="Pick chords to practise from the Practice tab."
          action={<ButtonLink to={PRACTICE_PATH}>Go to Practice</ButtonLink>}
        />
      </Screen>
    );
  }
  return (
    <Screen title={title(chords)} backTo={back} backLabel="Close">
      {/* A new set of chords gets a fresh trainer. */}
      <Trainer
        key={`${chords.join(',')}:${String(learn)}`}
        chords={chords}
        learn={learn}
        back={back}
      />
    </Screen>
  );
}
