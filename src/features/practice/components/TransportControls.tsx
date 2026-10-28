import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import type { TransportPhase } from '../engine/transport';

interface TransportControlsProps {
  phase: TransportPhase;
  starting: boolean;
  waitMode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onNext: () => void;
}

const PLAY_LABELS: Partial<Record<TransportPhase, string>> = {
  idle: 'Play',
  paused: 'Resume',
  finished: 'Play again',
};

export function TransportControls({
  phase,
  starting,
  waitMode,
  onPlay,
  onPause,
  onRestart,
  onNext,
}: TransportControlsProps) {
  const moving = phase === 'countIn' || phase === 'playing' || phase === 'waiting';
  // Keyed, so toggling wait mode moves the buttons rather than turning one into another.
  const restart = (
    <Button key="restart" variant="secondary" size="lg" icon={RotateCcw} onClick={onRestart}>
      Restart
    </Button>
  );
  const playClass = waitMode ? 'col-span-2' : undefined;
  const playPause = moving ? (
    <Button key="play" size="lg" icon={Pause} className={playClass} onClick={onPause}>
      Pause
    </Button>
  ) : (
    <Button
      key="play"
      size="lg"
      icon={Play}
      className={playClass}
      onClick={onPlay}
      disabled={starting}
    >
      {starting ? 'Starting…' : (PLAY_LABELS[phase] ?? 'Play')}
    </Button>
  );
  const next = (
    <Button
      key="next"
      variant="secondary"
      size="lg"
      icon={SkipForward}
      onClick={onNext}
      disabled={phase !== 'waiting'}
    >
      Next
    </Button>
  );

  return (
    <div
      className={cx(
        'grid items-center gap-2',
        // Three big buttons don't fit across a phone: Play gets its own row.
        waitMode ? 'grid-cols-2' : 'grid-cols-[1fr_2fr]',
      )}
    >
      {waitMode ? [playPause, restart, next] : [restart, playPause]}
    </div>
  );
}
