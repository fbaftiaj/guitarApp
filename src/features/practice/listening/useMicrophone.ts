import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireAudio, isWebAudioSupported, type AudioLease } from '@/audio/context';
import type { AnalysisHandlers } from '@/audio/analysisInput';
import type { Listener } from '@/audio/listener';
import type { AnalysisFeatures } from '@/audio/worklets/analysisProtocol';
import type { ListeningError } from './microphoneErrors';
import { openInput } from './openInput';

export type MicrophoneStatus = 'idle' | 'starting' | 'listening';

export interface Microphone {
  status: MicrophoneStatus;
  error: ListeningError | 'audio-unsupported' | null;
  /** Starts listening; call from a tap (iOS needs the gesture). */
  start: () => void;
  stop: () => void;
}

/**
 * Listens through the shared listener, with no playback: for screens that
 * only react to what is played (the chord trainer, the chord check). The
 * latest `handlers` are always used. The microphone is released on stop,
 * when the app goes to the background and when the screen closes.
 */
export function useMicrophone(features: AnalysisFeatures, handlers: AnalysisHandlers): Microphone {
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [error, setError] = useState<Microphone['error']>(null);
  const active = useRef<{ lease: AudioLease; listener: Listener | null } | null>(null);
  const generation = useRef(0);
  const handlersRef = useRef(handlers);
  const featuresRef = useRef(features);
  useEffect(() => {
    handlersRef.current = handlers;
    featuresRef.current = features;
  });

  const stop = useCallback(() => {
    generation.current++;
    const current = active.current;
    active.current = null;
    current?.listener?.close();
    current?.lease.release();
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (active.current) return;
    if (!isWebAudioSupported()) {
      setError('audio-unsupported');
      return;
    }
    // Synchronous, before any await: keeps the user gesture iOS requires.
    const lease = acquireAudio();
    const session: { lease: AudioLease; listener: Listener | null } = { lease, listener: null };
    active.current = session;
    const mine = ++generation.current;
    const current = () => generation.current === mine;
    setStatus('starting');
    setError(null);
    void (async () => {
      try {
        await lease.resumed;
        const listener = await openInput(
          lease.context,
          {
            features: featuresRef.current,
            onPitch: (frame) => {
              if (current()) handlersRef.current.onPitch?.(frame);
            },
            onOnset: (onset) => {
              if (current()) handlersRef.current.onOnset?.(onset);
            },
            onChroma: (event) => {
              if (current()) handlersRef.current.onChroma?.(event);
            },
            onEnded: () => {
              if (!current()) return;
              setError('disconnected');
              stop();
            },
          },
          setError,
        );
        if (!current()) {
          listener.close();
          return;
        }
        session.listener = listener;
        setStatus('listening');
      } catch {
        // openInput has reported the error.
        if (current()) stop();
      }
    })();
  }, [stop]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [stop]);

  return { status, error, start, stop };
}
