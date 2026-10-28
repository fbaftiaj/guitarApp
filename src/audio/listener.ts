import { connectAnalysisInput, type AnalysisHandlers } from './analysisInput';
import { openMicrophone, stopStream } from './microphone';
import type { AnalysisFeatures } from './worklets/analysisProtocol';

export interface ListenerOptions extends AnalysisHandlers {
  features: AnalysisFeatures;
  /** The microphone went away: unplugged, permission revoked or taken by another app. */
  onEnded?: () => void;
}

export interface Listener {
  configure(features: AnalysisFeatures): void;
  /** Stops analysis and releases the microphone (the browser's mic indicator goes off). */
  close(): void;
}

/**
 * Opens the microphone and analyses it in the analysis worklet on `context`:
 * the one input path shared by the tuner and the practicer. Rejects with a
 * `MicrophoneError` when the microphone cannot be opened.
 */
export async function openListener(
  context: AudioContext,
  { features, onEnded, ...handlers }: ListenerOptions,
): Promise<Listener> {
  const stream = await openMicrophone();
  let input;
  try {
    input = await connectAnalysisInput(context, stream, features, handlers);
  } catch (error) {
    stopStream(stream);
    throw error;
  }
  const track = stream.getAudioTracks()[0];
  const ended = () => {
    onEnded?.();
  };
  track?.addEventListener('ended', ended);
  let closed = false;
  return {
    configure: (next) => {
      input.configure(next);
    },
    close: () => {
      if (closed) return;
      closed = true;
      track?.removeEventListener('ended', ended);
      input.disconnect();
      stopStream(stream);
    },
  };
}
