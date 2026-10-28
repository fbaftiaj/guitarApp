import { Flag } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHORDS } from '@/content/chords';
import type { Exercise } from '@/content/exercises';
import { useWakeLock } from '@/platform/useWakeLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorState } from '@/ui/ErrorState';
import { DisplayOptions } from './components/DisplayOptions';
import { ListeningPanel } from './components/ListeningPanel';
import { MixControls } from './components/MixControls';
import { PlayAlong } from './components/PlayAlong';
import { PracticeOptions } from './components/PracticeOptions';
import { ResultsSheet } from './components/ResultsSheet';
import { TempoControl } from './components/TempoControl';
import { TransportControls } from './components/TransportControls';
import { arrange } from './engine/arrangement';
import { compileExercise } from './engine/timeline';
import type { TransportNotice, TransportPhase } from './engine/transport';
import { usePracticeListening } from './listening/usePracticeListening';
import { resolveExercisePrefs, usePracticeStore, type ExercisePrefs } from './practiceStore';
import { describeNote, playingItems, transportSettings } from './practiceView';
import type { SessionSummary } from './scoring/summary';
import { usePracticeSession, type PracticeView } from './usePracticeSession';
import { usePracticeTime } from './usePracticeTime';

function announcementFor(
  view: PracticeView,
  exercise: Exercise,
  waitingFor: string | null,
  listening: boolean,
): string | null {
  switch (view.phase) {
    case 'countIn':
      return 'Count-in';
    case 'playing':
      return 'Playing';
    case 'paused':
      return `Paused at bar ${view.bar + 1}`;
    case 'waiting':
      if (!waitingFor) return null;
      return `Waiting for ${waitingFor}. ${listening ? 'Play it to carry on.' : 'Play it, then tap Next.'}`;
    case 'finished':
      return `Finished ${exercise.title}. Well played!`;
    case 'idle':
      return null;
  }
}

const MOVING: readonly TransportPhase[] = ['countIn', 'playing', 'waiting'];
/** Results wait this long after the end, for the last strums' checks to come in. */
const RESULTS_DELAY_MS = 400;

/**
 * The practicer for one exercise: play-along view, transport, listening and
 * options. Screens put it under their own header (see PracticerScreen); a
 * new exercise needs a new instance (`key` it by the exercise id).
 */
export function Practicer({ exercise }: { exercise: Exercise }) {
  const timeline = useMemo(() => compileExercise(exercise), [exercise]);
  const events = useMemo(() => arrange(timeline), [timeline]);

  const saved = usePracticeStore((state) => state.exercises[exercise.id]);
  const mix = usePracticeStore((state) => state.mix);
  const labels = usePracticeStore((state) => state.labels);
  const fretboard = usePracticeStore((state) => state.fretboard);
  const setBus = usePracticeStore((state) => state.setBus);
  const setLabel = usePracticeStore((state) => state.setLabel);
  const setFretboard = usePracticeStore((state) => state.setFretboard);
  const listeningEnabled = usePracticeStore((state) => state.listening);
  const setListening = usePracticeStore((state) => state.setListening);
  const a4 = useSettingsStore((state) => state.referencePitch);
  const latencyMs = useSettingsStore((state) => state.latencyMs);
  const prefs = useMemo(() => resolveExercisePrefs(saved, exercise), [saved, exercise]);
  const settings = useMemo(
    () => transportSettings(prefs, exercise, timeline.beatsPerBar),
    [prefs, exercise, timeline.beatsPerBar],
  );

  const updatePrefs = useCallback(
    (patch: Partial<ExercisePrefs>) => {
      // Read the latest saved state: speed-up can change the tempo between renders.
      const { exercises, setExercisePrefs } = usePracticeStore.getState();
      const current = resolveExercisePrefs(exercises[exercise.id], exercise);
      setExercisePrefs(exercise.id, { ...current, ...patch });
    },
    [exercise],
  );

  const [announcement, setAnnouncement] = useState('');
  const onNotice = useCallback((notice: TransportNotice) => {
    if (notice.kind === 'pass' && notice.tempo > notice.previousTempo) {
      setAnnouncement(`Loop ${notice.pass + 1}: tempo up to ${notice.tempo} BPM`);
    }
  }, []);
  const onTempoChange = useCallback(
    (tempo: number) => {
      updatePrefs({ tempo });
    },
    [updatePrefs],
  );

  const listening = usePracticeListening({
    timeline,
    exercise,
    enabled: listeningEnabled,
    waitMode: prefs.waitMode,
    a4,
    latencyMs,
  });
  const session = usePracticeSession({
    timeline,
    events,
    settings,
    mix,
    a4,
    onTempoChange,
    onNotice,
    input: listening.input,
  });
  const { view } = session;
  const moving = MOVING.includes(view.phase);
  useWakeLock(moving);
  usePracticeTime(moving);

  // Wait mode: the awaited chord or note was heard, so carry on.
  const { next } = session;
  useEffect(() => {
    if (listening.waitSatisfied > 0) next();
  }, [listening.waitSatisfied, next]);

  const [results, setResults] = useState<SessionSummary | null>(null);
  const { finish: finishListening, reset: resetListening } = listening;
  const showResults = useCallback(() => {
    // The tempo may have been raised by speed-up since the last render.
    const { exercises } = usePracticeStore.getState();
    const summary = finishListening(resolveExercisePrefs(exercises[exercise.id], exercise).tempo);
    resetListening();
    if (summary) setResults(summary);
  }, [exercise, finishListening, resetListening]);
  useEffect(() => {
    if (view.phase !== 'finished' || !listening.input) return;
    const timer = window.setTimeout(showResults, RESULTS_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [listening.input, showResults, view.phase]);

  const { pause, restart } = session;
  const finishSession = useCallback(() => {
    pause();
    window.setTimeout(() => {
      showResults();
      restart();
    }, RESULTS_DELAY_MS);
  }, [pause, restart, showResults]);
  const restartSession = useCallback(() => {
    restart();
    resetListening();
  }, [resetListening, restart]);
  const { clearError: clearListeningError } = listening;
  const play = useCallback(() => {
    clearListeningError();
    setResults(null);
    session.play();
  }, [clearListeningError, session]);
  const scored = listening.feedback !== null || listening.waitSatisfied > 0;

  const loops = settings.loop !== null || settings.speedUp !== null;
  const { chord, note } = playingItems(
    timeline,
    view,
    settings.loop ?? { start: 0, end: timeline.totalBeats },
    loops,
  );

  const waitingFor =
    timeline.kind === 'chords'
      ? (CHORDS.get(chord?.chordId ?? '')?.name ?? null)
      : note && describeNote(note);
  // Each phase has one stable message, so the live region speaks only when the phase changes.
  const phaseAnnouncement = announcementFor(view, exercise, waitingFor, listening.input !== null);

  return (
    <>
      {session.error === 'audio-unsupported' ? (
        <ErrorState
          title="Audio isn’t available"
          description="This browser can’t play the metronome and backing track. Try a recent Chrome, Edge, Firefox or Safari."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-pretty text-fg-muted">{exercise.description}</p>

          <section aria-label="Play along" className="space-y-3">
            <PlayAlong
              timeline={timeline}
              session={session}
              tempo={prefs.tempo}
              loop={settings.loop}
              loops={loops}
              labels={labels}
              fretboard={fretboard}
              feedback={listening.feedback}
              scoring={listening.input !== null}
            />
            {session.error === 'audio-blocked' && (
              <p role="alert" className="text-center text-sm text-warning">
                The browser didn’t start the sound. Tap Play again.
              </p>
            )}
            <TransportControls
              phase={view.phase}
              starting={session.starting}
              waitMode={prefs.waitMode}
              onPlay={play}
              onPause={session.pause}
              onRestart={restartSession}
              onNext={session.next}
            />
            {view.phase === 'waiting' && listening.input && (
              <p role="status" className="text-center text-sm text-fg-muted">
                {listening.wrongAttempts > 0 ? (
                  <span
                    key={listening.wrongAttempts}
                    className="inline-block animate-pop-in text-warning"
                  >
                    Not quite. Try again.
                  </span>
                ) : (
                  'Listening… play it to carry on.'
                )}
              </p>
            )}
            {listening.input && scored && view.phase !== 'idle' && view.phase !== 'finished' && (
              <Button variant="ghost" icon={Flag} fullWidth onClick={finishSession}>
                Finish and see results
              </Button>
            )}
            {view.phase === 'finished' && !listening.input && (
              <p className="text-center text-sm text-fg-muted">
                Well played! Play again, or turn on Loop or Auto speed-up to keep going.
              </p>
            )}
          </section>

          <Card>
            <h2 className="mb-1 font-semibold">Listening</h2>
            <ListeningPanel
              enabled={listeningEnabled}
              onEnabledChange={(enabled) => {
                if (moving) session.pause();
                clearListeningError();
                setListening(enabled);
              }}
              latencyMs={latencyMs}
              error={listening.error}
              onRetry={play}
            />
          </Card>

          <Card>
            <TempoControl
              tempo={prefs.tempo}
              target={exercise.tempo}
              onChange={(tempo) => {
                updatePrefs({ tempo });
              }}
            />
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Practice</h2>
            <PracticeOptions
              prefs={prefs}
              totalBars={timeline.totalBars}
              currentBar={view.bar}
              targetTempo={exercise.tempo}
              onChange={updatePrefs}
            />
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Sound</h2>
            <MixControls mix={mix} onChange={setBus} />
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Display</h2>
            <DisplayOptions
              labels={labels}
              fretboard={fretboard}
              onLabelChange={setLabel}
              onFretboardChange={setFretboard}
            />
          </Card>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {phaseAnnouncement}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <ResultsSheet
        summary={results}
        onClose={() => {
          setResults(null);
        }}
        onPlayAgain={play}
        onTryTempo={(tempo) => {
          updatePrefs({ tempo });
          play();
        }}
      />
    </>
  );
}
