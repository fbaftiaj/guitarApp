import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireAudio, isWebAudioSupported, type AudioLease } from '@/audio/context';
import type { Listener } from '@/audio/listener';
import { openInput } from '../practice/listening/openInput';
import type { ListeningError } from '../practice/listening/microphoneErrors';
import { judgeStrum, type StrumJudgement } from './chordCheck';

export type ChordCheckStatus = 'idle' | 'starting' | 'listening';

export interface ChordCheck {
  status: ChordCheckStatus;
  error: ListeningError | 'audio-unsupported' | null;
  /** The latest strum's judgement, numbered so a repeat of the same result still shows. */
  result: (StrumJudgement & { attempt: number }) | null;
  /** Starts listening; call from a tap (iOS needs the gesture). */
  start: () => void;
  stop: () => void;
}

/**
 * Listens for strums of one chord and judges each with the same chord
 * recognition the practicer uses. The microphone is released on stop, when
 * the app goes to the background and when the screen closes.
 */
export function useChordCheck(chordId: string, a4: number): ChordCheck {
  const [status, setStatus] = useState<ChordCheckStatus>('idle');
  const [error, setError] = useState<ChordCheck['error']>(null);
  const [result, setResult] = useState<ChordCheck['result']>(null);
  const active = useRef<{ lease: AudioLease; listener: Listener | null } | null>(null);
  const generation = useRef(0);

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
    setStatus('starting');
    setError(null);
    setResult(null);
    let attempt = 0;
    void (async () => {
      try {
        await lease.resumed;
        const listener = await openInput(
          lease.context,
          {
            features: { pitch: null, onsets: true, chroma: true, a4 },
            onChroma: (event) => {
              if (generation.current !== mine) return;
              setResult({ ...judgeStrum(event.chroma, chordId), attempt: ++attempt });
            },
            onEnded: () => {
              if (generation.current !== mine) return;
              setError('disconnected');
              stop();
            },
          },
          setError,
        );
        if (generation.current !== mine) {
          listener.close();
          return;
        }
        session.listener = listener;
        setStatus('listening');
      } catch {
        // openInput reported the error.
        if (generation.current === mine) stop();
      }
    })();
  }, [a4, chordId, stop]);

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

  return { status, error, result, start, stop };
}
