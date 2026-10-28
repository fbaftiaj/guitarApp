import { openListener, type Listener, type ListenerOptions } from '@/audio/listener';
import { MicrophoneError } from '@/audio/microphone';
import type { ListeningError } from './microphoneErrors';

/** The listener, or the reason it could not open (already reported to `onError`). */
export async function openInput(
  context: AudioContext,
  options: ListenerOptions,
  onError: (error: ListeningError) => void,
): Promise<Listener> {
  try {
    return await openListener(context, options);
  } catch (cause) {
    console.error('[practice] could not start listening', cause);
    onError(cause instanceof MicrophoneError ? cause.kind : 'unknown');
    throw cause;
  }
}

/** Keeps the microphone open briefly after playback stops, for late results. */
export const CLOSE_DELAY_MS = 800;
