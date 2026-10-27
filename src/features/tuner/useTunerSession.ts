import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { acquireAudio, isWebAudioSupported, type AudioLease } from '@/audio/context';
import type { DetectionRange, PitchFrame } from '@/audio/dsp/pitchAnalyzer';
import { PitchStabilizer } from '@/audio/dsp/pitchStabilizer';
import {
  MicrophoneError,
  openMicrophone,
  stopStream,
  type MicrophoneErrorKind,
} from '@/audio/microphone';
import { connectPitchInput, type PitchInput } from '@/audio/pitchInput';
import { createReferenceTonePlayer, type ToneTimbre } from '@/audio/synth/referenceTone';
import {
  LISTENING,
  TunerEngine,
  type TunerEvent,
  type TunerMode,
  type TunerReading,
  type TunerTarget,
} from './tunerEngine';

export type SessionStatus = 'idle' | 'starting' | 'listening' | 'paused' | 'error';
export type SessionError = MicrophoneErrorKind | 'audio-unsupported';

export interface TunerSessionConfig {
  mode: TunerMode;
  targets: readonly TunerTarget[];
  a4: number;
  /** String to tune in manual mode. */
  selectedIndex: number;
  range: DetectionRange;
  timbre: ToneTimbre;
  /** Called for every tuner event (string tuned, all tuned, …). */
  onEvent?: (event: TunerEvent) => void;
}

export interface TunerSnapshot {
  reading: TunerReading;
  /** Indices of strings ticked off as in tune. */
  tuned: ReadonlySet<number>;
  allTuned: boolean;
}

export interface TunerSession {
  status: SessionStatus;
  error: SessionError | null;
  snapshot: TunerSnapshot;
  /** Cents offset updated on every frame (~100 Hz), for the needle animation. */
  centsRef: RefObject<number | null>;
  /** Starts listening. Call from a tap/click handler (iOS needs the gesture). */
  start: () => void;
  stop: () => void;
  /** Plays the target note of a string (also needs a gesture). */
  playReference: (index: number) => void;
  resetTuned: () => void;
}

interface ActiveSession {
  lease: AudioLease;
  stream: MediaStream;
  input: PitchInput;
  detach: () => void;
}

/** Screen updates are throttled; discrete changes (note, cue, ticks) publish at once. */
const PUBLISH_INTERVAL_MS = 50;
const RESUME_TIMEOUT_MS = 1500;
/** No ticks until a reference note (and its echo) has died away. */
const REFERENCE_TAIL_SECONDS = 0.15;

/** The browser would not start audio without a fresh tap (iOS after backgrounding). */
class NeedsGestureError extends Error {
  override readonly name = 'NeedsGestureError';
}

/** A newer start or a stop superseded this start while it was waiting. */
class StartCancelled extends Error {
  override readonly name = 'StartCancelled';
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

function engineOptions(config: TunerSessionConfig) {
  const { mode, targets, a4, selectedIndex } = config;
  return { mode, targets, a4, selectedIndex };
}

/**
 * Owns the tuner's audio lifecycle: microphone, shared AudioContext and the
 * pitch worklet, feeding readings through the stabilizer into the
 * TunerEngine. The microphone is released on stop, unmount and when the app
 * goes to the background (resuming on return where the browser allows it).
 */
export function useTunerSession(config: TunerSessionConfig): TunerSession {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<SessionError | null>(null);
  const [engine] = useState(() => new TunerEngine(engineOptions(config)));
  const [player] = useState(() => createReferenceTonePlayer());
  const [snapshot, setSnapshot] = useState<TunerSnapshot>(() => ({
    reading: LISTENING,
    tuned: new Set(),
    allTuned: false,
  }));

  const configRef = useRef(config);
  const centsRef = useRef<number | null>(null);
  const activeRef = useRef<ActiveSession | null>(null);
  const generationRef = useRef(0);
  const resumeOnReturnRef = useRef(false);
  const lastPublishRef = useRef({ at: 0, key: '' });
  const tunedRef = useRef<ReadonlySet<number>>(new Set());

  const publish = useCallback(
    (force: boolean) => {
      const { reading } = engine;
      const key = `${reading.status}|${reading.targetIndex ?? ''}|${reading.cue ?? ''}|${reading.note?.midi ?? ''}`;
      const now = performance.now();
      const last = lastPublishRef.current;
      if (!force && key === last.key && now - last.at < PUBLISH_INTERVAL_MS) return;
      lastPublishRef.current = { at: now, key };
      const tuned = engine.tuned;
      // Only hand out a new Set when the ticks changed, so memoised parts stay put.
      const sameTicks =
        tunedRef.current.size === tuned.size && [...tuned].every((i) => tunedRef.current.has(i));
      if (!sameTicks) tunedRef.current = new Set(tuned);
      setSnapshot({
        reading,
        tuned: tunedRef.current,
        allTuned:
          configRef.current.targets.length > 0 && tuned.size === configRef.current.targets.length,
      });
    },
    [engine],
  );

  useEffect(() => {
    configRef.current = config;
  });

  const { mode, targets, a4, selectedIndex, range } = config;
  useEffect(() => {
    engine.configure({ mode, targets, a4, selectedIndex });
    centsRef.current = null;
    publish(true);
  }, [engine, publish, mode, targets, a4, selectedIndex]);

  useEffect(() => {
    activeRef.current?.input.setRange(range);
  }, [range]);

  const handleFrame = useCallback(
    (stabilizer: PitchStabilizer, frame: PitchFrame) => {
      const events = engine.update(frame.time, stabilizer.push(frame));
      centsRef.current = engine.reading.cents;
      events.forEach((event) => configRef.current.onEvent?.(event));
      publish(events.length > 0);
    },
    [engine, publish],
  );

  const teardown = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    active.detach();
    active.input.disconnect();
    stopStream(active.stream);
    active.lease.release();
    engine.clearReading();
    centsRef.current = null;
    publish(true);
  }, [engine, publish]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    if (!isWebAudioSupported()) {
      setStatus('error');
      setError('audio-unsupported');
      return;
    }
    // Synchronous, before any await: keeps the user gesture iOS requires.
    const lease = acquireAudio();
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current;
    setStatus('starting');
    setError(null);

    void (async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await openMicrophone();
        await withTimeout(lease.resumed, RESUME_TIMEOUT_MS);
        if (!isCurrent()) throw new StartCancelled();
        if (lease.context.state !== 'running') throw new NeedsGestureError();
        const stabilizer = new PitchStabilizer();
        const input = await connectPitchInput(
          lease.context,
          stream,
          configRef.current.range,
          (frame) => {
            if (isCurrent()) handleFrame(stabilizer, frame);
          },
        );
        if (!isCurrent()) {
          input.disconnect();
          throw new StartCancelled();
        }

        const ownStream = stream;
        const track = ownStream.getAudioTracks()[0];
        const onTrackEnded = () => {
          teardown();
          setStatus('error');
          setError('disconnected');
        };
        const onStateChange = () => {
          // iOS reports "interrupted" for calls and Siri; other browsers suspend.
          if (lease.context.state !== 'running' && activeRef.current) {
            teardown();
            setStatus('paused');
          }
        };
        track?.addEventListener('ended', onTrackEnded);
        lease.context.addEventListener('statechange', onStateChange);
        activeRef.current = {
          lease,
          stream: ownStream,
          input,
          detach: () => {
            track?.removeEventListener('ended', onTrackEnded);
            lease.context.removeEventListener('statechange', onStateChange);
          },
        };
        setStatus('listening');
      } catch (cause) {
        if (stream) stopStream(stream);
        lease.release();
        if (!isCurrent() || cause instanceof StartCancelled) return;
        if (cause instanceof NeedsGestureError) {
          setStatus('paused');
          return;
        }
        console.error('[tuner] could not start listening', cause);
        setStatus('error');
        setError(cause instanceof MicrophoneError ? cause.kind : 'unknown');
      }
    })();
  }, [handleFrame, teardown]);

  const stop = useCallback(() => {
    generationRef.current++;
    resumeOnReturnRef.current = false;
    teardown();
    setStatus('idle');
  }, [teardown]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (activeRef.current) {
          generationRef.current++;
          resumeOnReturnRef.current = true;
          teardown();
          setStatus('paused');
        }
      } else if (resumeOnReturnRef.current) {
        resumeOnReturnRef.current = false;
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [start, teardown]);

  useEffect(
    () => () => {
      generationRef.current++;
      teardown();
      player.stop();
    },
    [player, teardown],
  );

  const playReference = useCallback(
    (index: number) => {
      const target = configRef.current.targets[index];
      if (!target) return;
      const tone = player.play(target.frequency, configRef.current.timbre);
      engine.holdTicks(tone.endsAt + REFERENCE_TAIL_SECONDS);
    },
    [engine, player],
  );

  const resetTuned = useCallback(() => {
    engine.resetTuned();
    centsRef.current = null;
    publish(true);
  }, [engine, publish]);

  return { status, error, snapshot, centsRef, start, stop, playReference, resetTuned };
}
