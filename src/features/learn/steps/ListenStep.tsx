import { useMemo } from 'react';
import type { Lesson } from '@/content/course';
import { useWakeLock } from '@/platform/useWakeLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { ErrorState } from '@/ui/ErrorState';
import { PlayAlong } from '../../practice/components/PlayAlong';
import { TransportControls } from '../../practice/components/TransportControls';
import { arrange } from '../../practice/engine/arrangement';
import { compileExercise } from '../../practice/engine/timeline';
import { usePracticeStore } from '../../practice/practiceStore';
import { playThroughSettings } from '../../practice/practiceView';
import { usePracticeSession } from '../../practice/usePracticeSession';

/** The guide plays at least this loud on the Listen step, so every strum or note is heard. */
const GUIDE_VOLUME = 0.8;
const keepTempo = () => undefined;

/** The exercise played for you at its target tempo, guide on, nothing to score. */
export function ListenStep({ lesson }: { lesson: Lesson }) {
  const { exercise } = lesson;
  const timeline = useMemo(() => compileExercise(exercise), [exercise]);
  const events = useMemo(() => arrange(timeline), [timeline]);
  const settings = useMemo(() => playThroughSettings(exercise.tempo), [exercise.tempo]);
  const mix = usePracticeStore((state) => state.mix);
  const labels = usePracticeStore((state) => state.labels);
  const fretboard = usePracticeStore((state) => state.fretboard);
  const a4 = useSettingsStore((state) => state.referencePitch);
  const listenMix = useMemo(
    () => ({
      ...mix,
      guide: { enabled: true, volume: Math.max(mix.guide.volume, GUIDE_VOLUME) },
    }),
    [mix],
  );

  const session = usePracticeSession({
    timeline,
    events,
    settings,
    mix: listenMix,
    a4,
    onTempoChange: keepTempo,
  });
  const { view } = session;
  useWakeLock(view.phase === 'countIn' || view.phase === 'playing');

  if (session.error === 'audio-unsupported') {
    return (
      <ErrorState
        title="Audio isn’t available"
        description="This browser can’t play the exercise. Try a recent Chrome, Edge, Firefox or Safari."
      />
    );
  }
  return (
    <section aria-label="Listen" className="space-y-3">
      <p className="text-sm text-pretty text-fg-muted">
        Hear how it should sound at the target tempo, {exercise.tempo} BPM. The guide plays every{' '}
        {exercise.kind === 'chords' ? 'strum' : 'note'}; follow along on the highway and count with
        the click.
      </p>
      <PlayAlong
        timeline={timeline}
        session={session}
        tempo={exercise.tempo}
        loop={null}
        loops={false}
        labels={labels}
        fretboard={fretboard}
        feedback={null}
        scoring={false}
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
        onPlay={session.play}
        onPause={session.pause}
        onRestart={session.restart}
        onNext={session.next}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {view.phase === 'finished' ? 'Finished.' : view.phase === 'playing' ? 'Playing' : ''}
      </p>
    </section>
  );
}
