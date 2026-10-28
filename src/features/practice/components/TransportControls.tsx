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
  return (
    <div
      className={cx(
        'grid items-center gap-2',
        waitMode ? 'grid-cols-[1fr_1.4fr_1fr]' : 'grid-cols-[1fr_2fr]',
      )}
    >
      <Button variant="secondary" size="lg" icon={RotateCcw} onClick={onRestart}>
        Restart
      </Button>
      {moving ? (
        <Button size="lg" icon={Pause} onClick={onPause}>
          Pause
        </Button>
      ) : (
        <Button size="lg" icon={Play} onClick={onPlay} disabled={starting}>
          {starting ? 'Starting…' : (PLAY_LABELS[phase] ?? 'Play')}
        </Button>
      )}
      {waitMode && (
        <Button
          variant="secondary"
          size="lg"
          icon={SkipForward}
          onClick={onNext}
          disabled={phase !== 'waiting'}
        >
          Next
        </Button>
      )}
    </div>
  );
}
