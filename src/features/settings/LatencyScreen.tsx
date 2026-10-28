import { Headphones, Mic, Play, RotateCcw, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SETTINGS_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { CalibrationInput } from '@/features/practice/listening/calibrationInput';
import {
  CALIBRATION_BEATS,
  CALIBRATION_MIX,
  CALIBRATION_SETTINGS,
  CALIBRATION_TIMELINE,
} from '@/features/practice/listening/calibrationTimeline';
import {
  LISTENING_ERRORS,
  type ListeningError,
} from '@/features/practice/listening/microphoneErrors';
import { BLUETOOTH_LATENCY_MS, type CalibrationResult } from '@/features/practice/scoring/latency';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { cx } from '@/ui/cx';
import { ErrorState } from '@/ui/ErrorState';

type Outcome =
  | { kind: 'none' }
  | { kind: 'result'; result: CalibrationResult }
  | { kind: 'error'; error: ListeningError };

const noop = () => undefined;

function failureText(result: Extract<CalibrationResult, { ok: false }>): string {
  return result.reason === 'too-few'
    ? `FretPath heard ${result.matched} of ${CALIBRATION_BEATS} beats. Play a little louder, closer to the device, on every click.`
    : 'Your strums were uneven against the clicks. Try again, keeping as steady as you can.';
}

/**
 * Latency calibration: the player strums along with eight clicks and the
 * typical delay between each click and the strum heard is stored. Scoring
 * subtracts it, so timing feedback is fair on any device.
 */
export function LatencyScreen() {
  const a4 = useSettingsStore((state) => state.referencePitch);
  const latencyMs = useSettingsStore((state) => state.latencyMs);
  const setLatency = useSettingsStore((state) => state.setLatency);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });
  const [heard, setHeard] = useState(0);
  const [input] = useState(
    () =>
      new CalibrationInput(a4, {
        onError: (error) => {
          setOutcome({ kind: 'error', error });
        },
        onResult: (result) => {
          setOutcome({ kind: 'result', result });
        },
        onHeard: () => {
          setHeard((count) => count + 1);
        },
      }),
  );
  useEffect(
    () => () => {
      input.close();
    },
    [input],
  );

  const session = usePracticeSession({
    timeline: CALIBRATION_TIMELINE,
    events: [],
    settings: CALIBRATION_SETTINGS,
    mix: CALIBRATION_MIX,
    a4,
    onTempoChange: noop,
    input,
  });
  const { phase, countIn, beat } = session.view;
  const running = phase === 'countIn' || phase === 'playing';
  const measuring = phase === 'finished' && outcome.kind === 'none';

  const start = () => {
    setOutcome({ kind: 'none' });
    setHeard(0);
    session.play();
  };
  const stop = () => {
    session.pause();
    session.restart();
  };

  const status = running
    ? phase === 'countIn'
      ? 'Get ready…'
      : 'Strum on every click'
    : measuring
      ? 'Measuring…'
      : null;

  if (outcome.kind === 'error') {
    const copy = LISTENING_ERRORS[outcome.error];
    return (
      <Screen title="Latency" backTo={SETTINGS_PATH} backLabel="Back to settings">
        <ErrorState
          title={copy.title}
          description={copy.description}
          onRetry={copy.retry ? start : undefined}
        />
      </Screen>
    );
  }

  const result = outcome.kind === 'result' ? outcome.result : null;
  return (
    <Screen title="Latency" backTo={SETTINGS_PATH} backLabel="Back to settings">
      <div className="space-y-4">
        <Card>
          <h2 className="font-semibold">Measure your device’s delay</h2>
          <p className="mt-2 text-sm text-pretty text-fg-muted">
            Sound takes a moment to leave the speaker and to reach FretPath from the microphone.
            Measure it once with the setup you practise with, so timing scores are fair.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            <li>Use the speaker or the wired headphones you practise with.</li>
            <li>
              After four count-in clicks, strum muted strings (or tap the guitar) on each of the
              next {CALIBRATION_BEATS} clicks.
            </li>
          </ol>
          <p className="mt-3 text-sm">
            {latencyMs === null ? (
              <span className="text-fg-muted">Not measured yet: FretPath uses an estimate.</span>
            ) : (
              <>
                Measured latency: <strong className="tabular-nums">{latencyMs} ms</strong>
              </>
            )}
          </p>
        </Card>

        <Card>
          <div aria-hidden className="flex items-center justify-center gap-2">
            {Array.from({ length: CALIBRATION_BEATS }, (_, i) => (
              <span
                key={i}
                className={cx(
                  'size-6 rounded-full border-2 transition-colors',
                  phase === 'playing' && Math.floor(beat) === i
                    ? 'border-accent bg-accent'
                    : phase === 'playing' && Math.floor(beat) > i
                      ? 'border-accent bg-accent/30'
                      : 'border-border-strong',
                )}
              />
            ))}
          </div>
          <p className="mt-3 flex min-h-6 items-center justify-center gap-2 text-sm font-medium">
            {phase === 'countIn' && countIn !== null && (
              <span className="text-lg font-bold text-accent-text tabular-nums">{countIn}</span>
            )}
            {status}
            {running && heard > 0 && (
              <span
                key={heard}
                className="inline-flex animate-pop-in items-center text-accent-text"
              >
                <Mic aria-hidden className="size-4" />
                <span className="sr-only">Heard</span>
              </span>
            )}
          </p>
          <p className="sr-only" aria-live="polite">
            {status ?? ''}
          </p>

          {result && (
            <div role="status" className="mt-3 text-center">
              {result.ok ? (
                <>
                  <p className="text-sm text-fg-muted">Your latency</p>
                  <p className="text-3xl font-bold tabular-nums">{result.latencyMs} ms</p>
                  {result.latencyMs >= BLUETOOTH_LATENCY_MS && (
                    <p className="mt-2 text-sm text-pretty text-warning">
                      That’s a long delay. Bluetooth headphones add 150–300 ms; wired headphones or
                      the device speaker give more reliable timing.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-pretty">{failureText(result)}</p>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {running ? (
              <Button variant="secondary" size="lg" icon={Square} onClick={stop}>
                Stop
              </Button>
            ) : result?.ok ? (
              <>
                <Button
                  size="lg"
                  onClick={() => {
                    setLatency(result.latencyMs);
                    setOutcome({ kind: 'none' });
                  }}
                >
                  Save {result.latencyMs} ms
                </Button>
                <Button variant="secondary" icon={RotateCcw} onClick={start}>
                  Measure again
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                icon={result ? RotateCcw : Play}
                onClick={start}
                disabled={session.starting || measuring}
              >
                {result ? 'Try again' : 'Start'}
              </Button>
            )}
          </div>
          {session.error === 'audio-blocked' && (
            <p role="alert" className="mt-2 text-center text-sm text-warning">
              The browser didn’t start the sound. Tap Start again.
            </p>
          )}
        </Card>

        <p className="flex gap-2 text-sm text-pretty text-fg-muted">
          <Headphones aria-hidden className="mt-0.5 size-4 shrink-0" />
          Bluetooth headphones add a long, variable delay. For practice with scoring, use the device
          speaker or wired headphones.
        </p>
        {latencyMs !== null && !running && (
          <Button
            variant="ghost"
            onClick={() => {
              setLatency(null);
            }}
          >
            Forget the measured latency
          </Button>
        )}
      </div>
    </Screen>
  );
}
