import { Music } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { PRACTICE_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { CHORDS } from '@/content/chords';
import { findExercise, type Exercise } from '@/content/exercises';
import { useWakeLock } from '@/platform/useWakeLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { DisplayOptions } from './components/DisplayOptions';
import { Highway } from './components/Highway';
import { MixControls } from './components/MixControls';
import { NowPanel } from './components/NowPanel';
import { PracticeOptions } from './components/PracticeOptions';
import { PracticeStatus } from './components/PracticeStatus';
import { TempoControl } from './components/TempoControl';
import { TransportControls } from './components/TransportControls';
import { arrange } from './engine/arrangement';
import { compileExercise } from './engine/timeline';
import type { TransportNotice, TransportPhase } from './engine/transport';
import { resolveExercisePrefs, usePracticeStore, type ExercisePrefs } from './practiceStore';
import { beatCounterLabels, describeNote, nextInRange, transportSettings } from './practiceView';
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
): string | null {
  switch (view.phase) {
    case 'countIn':
      return 'Count-in';
    case 'playing':
      return 'Playing';
    case 'paused':
      return `Paused at bar ${view.bar + 1}`;
    case 'waiting':
      return waitingFor ? `Waiting for ${waitingFor}. Play it, then tap Next.` : null;
    case 'finished':
      return `Finished ${exercise.title}. Well played!`;
    case 'idle':
      return null;
  }
}

const MOVING: readonly TransportPhase[] = ['countIn', 'playing', 'waiting'];

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
  const a4 = useSettingsStore((state) => state.referencePitch);
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

  const session = usePracticeSession({
    timeline,
    events,
    settings,
    mix,
    a4,
    onTempoChange,
    onNotice,
  });
  const { view } = session;
  const moving = MOVING.includes(view.phase);
  useWakeLock(moving);

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
  const phaseAnnouncement = announcementFor(view, exercise, waitingFor);

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
            >
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
              onPlay={session.play}
              onPause={session.pause}
              onRestart={session.restart}
              onNext={session.next}
            />
            {view.phase === 'finished' && (
              <p className="text-center text-sm text-fg-muted">
                Well played! Play again, or turn on Loop or Auto speed-up to keep going.
              </p>
            )}
          </section>

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
    </Screen>
  );
}
