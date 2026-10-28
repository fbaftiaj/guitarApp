import { ArrowDown, ArrowUp, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CHORDS } from '@/content/chords';
import type { Exercise } from '@/content/exercises';
import { usePrefersReducedMotion } from '@/platform/usePrefersReducedMotion';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { Fretboard } from '../../practice/components/Fretboard';
import { describeNote } from '../../practice/practiceView';
import { demoFrames, type DemoFrame } from '../lessonVisuals';

/** The demo runs a little slower than the target tempo, and pauses before it loops. */
const DEMO_TEMPO_RATIO = 0.75;
const LOOP_PAUSE_BEATS = 2;

function beatLabel(frame: DemoFrame, beatsPerBar: number): string {
  const inBar = frame.beat - frame.bar * beatsPerBar;
  const whole = Math.floor(inBar);
  return `beat ${whole + 1}${inBar - whole >= 0.5 ? ' &' : ''}`;
}

function frameText(frame: DemoFrame): string {
  if (frame.note) {
    const finger = frame.note.finger ? `, finger ${frame.note.finger}` : '';
    return `${describeNote(frame.note)}${finger}`;
  }
  const chord = CHORDS.get(frame.chordId ?? '');
  return `${chord?.name ?? frame.chordId ?? ''}, strum ${frame.direction ?? 'down'}`;
}

/**
 * A silent, animated fretboard that steps through the opening of an
 * exercise: where each finger goes and which way each strum moves. It plays
 * on its own unless the system asks for reduced motion; it can always be
 * stepped through by hand.
 */
export function FretboardDemo({ exercise }: { exercise: Exercise }) {
  const frames = useMemo(() => demoFrames(exercise), [exercise]);
  const reducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(!reducedMotion);
  const [index, setIndex] = useState(0);
  const frame = frames[index] ?? frames[0];
  const beatsPerBar = exercise.timeSignature.beats;

  useEffect(() => {
    if (!playing || !frame) return;
    const last = index >= frames.length - 1;
    const beats = frame.duration + (last ? LOOP_PAUSE_BEATS : 0);
    const timer = window.setTimeout(
      () => {
        setIndex((current) => (current + 1) % frames.length);
      },
      ((beats * 60) / (exercise.tempo * DEMO_TEMPO_RATIO)) * 1000,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [exercise.tempo, frame, frames.length, index, playing]);

  if (!frame) return null;
  const step = (delta: number) => {
    setPlaying(false);
    setIndex((current) => (current + delta + frames.length) % frames.length);
  };
  const Arrow = frame.direction === 'up' ? ArrowUp : ArrowDown;
  const text = frameText(frame);

  return (
    <div>
      <div className="relative">
        <Fretboard
          marks={frame.marks}
          showFingers
          showNoteNames={frame.note !== null}
          label={`Demo step ${index + 1} of ${frames.length}: ${text}`}
        />
        {frame.direction && (
          <span
            key={index}
            aria-hidden
            className={cx(
              'absolute top-1 right-1 flex size-9 items-center justify-center rounded-full border border-border bg-surface-raised',
              !reducedMotion && 'animate-pop-in',
              frame.direction === 'up' ? 'text-flat' : 'text-fg',
            )}
          >
            <Arrow className="size-5" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="mt-2 text-center text-sm">
        <span className="font-semibold">
          Bar {frame.bar + 1}, {beatLabel(frame, beatsPerBar)}
        </span>
        <span className="text-fg-muted"> · {text}</span>
      </p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <IconButton
          icon={SkipBack}
          label="Previous step"
          onClick={() => {
            step(-1);
          }}
        />
        <Button
          variant="secondary"
          icon={playing ? Pause : Play}
          aria-pressed={playing}
          onClick={() => {
            setPlaying(!playing);
          }}
          className="min-w-32"
        >
          {playing ? 'Pause demo' : 'Play demo'}
        </Button>
        <IconButton
          icon={SkipForward}
          label="Next step"
          onClick={() => {
            step(1);
          }}
        />
      </div>
    </div>
  );
}
