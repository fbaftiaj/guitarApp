import { useEffect, useRef } from 'react';
import { cx } from '@/ui/cx';
import type { MicrophoneStatus } from '../../practice/listening/useMicrophone';

const LABELS: Record<MicrophoneStatus, string> = {
  idle: 'Not listening',
  starting: 'Starting the microphone…',
  listening: 'Listening',
};

interface MicLevelProps {
  status: MicrophoneStatus;
  /** Input level updates (0–1); the bar follows them without re-rendering. */
  subscribe: (listener: (level: number) => void) => () => void;
}

/** Shows that the microphone is on and hears something. */
export function MicLevel({ status, subscribe }: MicLevelProps) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      subscribe((level) => {
        if (bar.current) bar.current.style.width = `${Math.round(level * 100)}%`;
      }),
    [subscribe],
  );
  return (
    <p className="flex items-center gap-2 text-sm text-fg-muted">
      <span
        aria-hidden
        className={cx(
          'size-2.5 shrink-0 rounded-full',
          status === 'listening' ? 'bg-accent motion-safe:animate-pulse' : 'bg-fg-subtle',
        )}
      />
      <span>{LABELS[status]}</span>
      <span
        aria-hidden
        className={cx(
          'h-1.5 w-16 overflow-hidden rounded-full bg-surface-raised',
          status !== 'listening' && 'invisible',
        )}
      >
        <span ref={bar} className="block h-full w-0 rounded-full bg-accent" />
      </span>
    </p>
  );
}
