import { useMemo } from 'react';
import type { Timeline } from '../engine/timeline';
import type { BeatRange } from '../engine/transport';
import type { ListeningFeedback } from '../listening/practiceListening';
import type { LabelKey } from '../practiceStore';
import { beatCounterLabels, playingItems } from '../practiceView';
import type { PracticeSession } from '../usePracticeSession';
import { Highway } from './Highway';
import { HitFeedbackBadge } from './HitFeedbackBadge';
import { NowPanel } from './NowPanel';
import { PracticeStatus } from './PracticeStatus';

interface PlayAlongProps {
  timeline: Timeline;
  session: Pick<PracticeSession, 'view' | 'subscribe'>;
  /** Tempo shown while the transport is still. */
  tempo: number;
  loop: BeatRange | null;
  /** Looping or speeding up: shows the pass and wraps the "next" chord or note. */
  loops: boolean;
  labels: Readonly<Record<LabelKey, boolean>>;
  fretboard: boolean;
  /** Scoring feedback, when listening. */
  feedback: ListeningFeedback | null;
  /** Shows the running accuracy (listening is on). */
  scoring: boolean;
}

/** What to play now and next, the scrolling highway and the beat counter. */
export function PlayAlong({
  timeline,
  session: { view, subscribe },
  tempo,
  loop,
  loops,
  labels,
  fretboard,
  feedback,
  scoring,
}: PlayAlongProps) {
  const range = loop ?? { start: 0, end: timeline.totalBeats };
  const { chord, nextChord, note, nextNote } = playingItems(timeline, view, range, loops);
  const showSlot = view.phase === 'playing' || view.phase === 'paused' || view.phase === 'waiting';
  const sounding = view.phase === 'countIn' || view.phase === 'playing';
  const counterLabels = useMemo(() => beatCounterLabels(timeline), [timeline]);

  return (
    <>
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
        subscribe={subscribe}
        beat={view.beat}
        moving={sounding}
        chordIndex={view.chordIndex}
        noteIndex={view.noteIndex}
        loop={loop}
        showChordNames={labels.chordNames}
        showNoteNames={labels.noteNames}
        marks={feedback?.marks}
      >
        {feedback && view.phase === 'playing' && (
          <HitFeedbackBadge
            key={`${feedback.hit.target.id}:${String(feedback.hit.final)}`}
            hit={feedback.hit}
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
        tempo={sounding ? view.tempo : tempo}
        pass={loops ? view.pass : null}
        accuracy={scoring ? (feedback?.accuracy ?? null) : null}
      />
    </>
  );
}
