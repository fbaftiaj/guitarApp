import { MicrophoneAlert } from '../../practice/components/MicrophoneAlert';
import { PlayAlong } from '../../practice/components/PlayAlong';
import { TransportControls } from '../../practice/components/TransportControls';
import type { ScoredRun } from '../useScoredRun';

/** The play-along view and controls of a scored run. */
export function ScoredRunView({ run, onRestart }: { run: ScoredRun; onRestart: () => void }) {
  const { session, listening, exercise } = run;
  const { view } = session;
  return (
    <>
      {listening.error && <MicrophoneAlert error={listening.error} onRetry={run.play} />}
      <PlayAlong
        timeline={run.timeline}
        session={session}
        tempo={exercise.tempo}
        loop={null}
        loops={false}
        labels={run.labels}
        fretboard={run.fretboard}
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
        onPlay={run.play}
        onPause={session.pause}
        onRestart={onRestart}
        onNext={session.next}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {view.phase === 'countIn' ? 'Count-in' : view.phase === 'playing' ? 'Listening' : ''}
      </p>
    </>
  );
}
