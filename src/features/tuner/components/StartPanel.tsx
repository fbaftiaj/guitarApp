import { Mic, Play } from 'lucide-react';
import { ErrorState } from '@/ui/ErrorState';
import { LoadingState } from '@/ui/LoadingState';
import type { SessionError, SessionStatus } from '../useTunerSession';

interface ErrorCopy {
  title: string;
  description: string;
  /** False when trying again cannot help (e.g. the page is not served over HTTPS). */
  retry: boolean;
}

const MICROPHONE_ERRORS: Record<SessionError, ErrorCopy> = {
  'permission-denied': {
    title: 'Microphone access is blocked',
    description:
      'Allow microphone access for FretPath in your browser’s site settings, then try again.',
    retry: true,
  },
  'not-found': {
    title: 'No microphone found',
    description: 'Connect a microphone or headset, then try again.',
    retry: true,
  },
  'in-use': {
    title: 'The microphone is busy',
    description: 'Another app is using the microphone. Close it, then try again.',
    retry: true,
  },
  disconnected: {
    title: 'The microphone disconnected',
    description: 'It stopped sending sound. Check that it is connected, then try again.',
    retry: true,
  },
  'insecure-context': {
    title: 'The tuner needs a secure connection',
    description: 'Browsers only allow the microphone on secure pages. Open FretPath over https://.',
    retry: false,
  },
  unsupported: {
    title: 'This browser can’t use the microphone',
    description: 'Use a current version of Chrome, Safari, Firefox or Edge.',
    retry: false,
  },
  'audio-unsupported': {
    title: 'This browser can’t run the tuner',
    description:
      'It lacks the audio features the tuner needs. Use a current version of Chrome, Safari, Firefox or Edge.',
    retry: false,
  },
  unknown: {
    title: 'The tuner couldn’t start',
    description: 'Something went wrong while starting the microphone. Try again.',
    retry: true,
  },
};

interface StartPanelProps {
  status: Exclude<SessionStatus, 'listening'>;
  error: SessionError | null;
  onStart: () => void;
}

/** What the tuner shows when it is not listening: start, starting, paused or an error. */
export function StartPanel({ status, error, onStart }: StartPanelProps) {
  if (status === 'starting') {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center text-center">
        <LoadingState label="Starting the microphone…" />
        <p className="max-w-xs text-sm text-fg-muted">
          If your browser asks, allow microphone access.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    const copy = MICROPHONE_ERRORS[error ?? 'unknown'];
    return (
      <div className="flex min-h-72 items-center justify-center">
        <ErrorState
          title={copy.title}
          description={copy.description}
          onRetry={copy.retry ? onStart : undefined}
        />
      </div>
    );
  }

  const paused = status === 'paused';
  const Icon = paused ? Play : Mic;
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-5 text-center">
      <button
        type="button"
        onClick={onStart}
        className="group relative flex size-36 flex-col items-center justify-center gap-2 rounded-full bg-accent text-accent-fg shadow-elevated transition-[scale,background-color] duration-150 hover:bg-accent-strong active:scale-95"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-ping motion-safe:[animation-duration:2.4s]"
        />
        <Icon aria-hidden className="relative size-9" strokeWidth={2.25} />
        <span className="relative text-base font-bold">
          {paused ? 'Tap to resume' : 'Tap to tune'}
        </span>
      </button>
      <p className="max-w-xs text-sm text-pretty text-fg-muted">
        {paused
          ? 'Tuning paused while FretPath was in the background.'
          : 'FretPath listens through your microphone. The sound stays on your device.'}
      </p>
    </div>
  );
}
