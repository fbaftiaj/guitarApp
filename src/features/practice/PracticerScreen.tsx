import { Flag, Music } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { PRACTICE_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { CHORDS } from '@/content/chords';
import { findExercise, type Exercise } from '@/content/exercises';
import { useWakeLock } from '@/platform/useWakeLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { DisplayOptions } from './components/DisplayOptions';
import { Highway } from './components/Highway';
import { HitFeedbackBadge } from './components/HitFeedbackBadge';
import { ListeningPanel } from './components/ListeningPanel';
import { MixControls } from './components/MixControls';
import { NowPanel } from './components/NowPanel';
import { PracticeOptions } from './components/PracticeOptions';
import { PracticeStatus } from './components/PracticeStatus';
import { ResultsSheet } from './components/ResultsSheet';
import { TempoControl } from './components/TempoControl';
import { TransportControls } from './components/TransportControls';
import { arrange } from './engine/arrangement';
import { compileExercise } from './engine/timeline';
import type { TransportNotice, TransportPhase } from './engine/transport';
import { usePracticeListening } from './listening/usePracticeListening';
import { resolveExercisePrefs, usePracticeStore, type ExercisePrefs } from './practiceStore';
import { beatCounterLabels, describeNote, nextInRange, transportSettings } from './practiceView';
import type { SessionSummary } from './scoring/summary';
import { usePracticeSession, type PracticeView } from './usePracticeSession';

export function PracticerScreen() {
  const { exerciseId = '' } = useParams();
  const exercise = findExercise(exerciseId);
  if (!exercise) {
    return (
      <Screen title="Exercise not found" backTo={PRACTICE_PATH} backLabel="All exercises">
        <EmptyState
          icon={Music}
          title="No such exercise"
          description="This exercise doesn’t exist. It may have been renamed or removed."
          action={<ButtonLink to={PRACTICE_PATH}>All exercises</ButtonLink>}
        />
      </Screen>
    );
  }
  // A new exercise gets a fresh session.
  return <Practicer key={exercise.id} exercise={exercise} />;
}

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

function Practicer({ exercise }: { exercise: Exercise }) {
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

  const range = settings.loop ?? { start: 0, end: timeline.totalBeats };
  const loops = settings.loop !== null || settings.speedUp !== null;
  const chord = timeline.chords[Math.max(0, view.chordIndex)] ?? null;
  const note = timeline.notes[view.noteIndex] ?? null;
  const nextChord = chord ? nextInRange(timeline.chords, chord.index, range, loops) : null;
  const nextNote = nextInRange(timeline.notes, view.noteIndex, range, loops);

  const waitingFor =
    timeline.kind === 'chords'
      ? (CHORDS.get(chord?.chordId ?? '')?.name ?? null)
      : note && describeNote(note);
  // Each phase has one stable message, so the live region speaks only when the phase changes.
  const phaseAnnouncement = announcementFor(view, exercise, waitingFor, listening.input !== null);

  const counterLabels = useMemo(() => beatCounterLabels(timeline), [timeline]);
  const showSlot = view.phase === 'playing' || view.phase === 'paused' || view.phase === 'waiting';

  return (
    <Screen title={exercise.title} backTo={PRACTICE_PATH} backLabel="All exercises">
      {session.error === 'audio-unsupported' ? (
        <ErrorState
          title="Audio isn’t available"
          description="This browser can’t play the metronome and backing track. Try a recent Chrome, Edge, Firefox or Safari."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-pretty text-fg-muted">{exercise.description}</p>

          <section aria-label="Play along" className="space-y-3">
            <NowPanel
              kind={timeline.kind}
              chord={chord}
              nextChord={nextChord}
              note={note}
              nextNote={nextNote}
              showChordNames={labels.chordNames}
              showFingers={labels.fingers}
              showNoteNames={labels.noteNames}
              showFretboard={fretboard}
            />
            <Highway
              timeline={timeline}
              subscribe={session.subscribe}
              beat={view.beat}
              moving={view.phase === 'countIn' || view.phase === 'playing'}
              chordIndex={view.chordIndex}
              noteIndex={view.noteIndex}
              loop={settings.loop}
              showChordNames={labels.chordNames}
              showNoteNames={labels.noteNames}
              marks={listening.feedback?.marks}
            >
              {listening.feedback && view.phase === 'playing' && (
                <HitFeedbackBadge
                  key={`${listening.feedback.hit.target.id}:${String(listening.feedback.hit.final)}`}
                  hit={listening.feedback.hit}
                />
              )}
              {view.phase === 'countIn' && (
                <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
                  <span className="animate-pop-in text-5xl font-bold text-accent-text tabular-nums">
                    {view.countIn ?? 'Ready'}
                  </span>
                </div>
              )}
            </Highway>
            <PracticeStatus
              bar={view.bar}
              totalBars={timeline.totalBars}
              labels={counterLabels}
              slot={showSlot ? view.slot : null}
              tempo={
                view.phase === 'countIn' || view.phase === 'playing' ? view.tempo : prefs.tempo
              }
              pass={loops ? view.pass : null}
              accuracy={listening.input ? (listening.feedback?.accuracy ?? null) : null}
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
    </Screen>
  );
}
