import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireAudio, isWebAudioSupported, type AudioLease } from '@/audio/context';
import {
  createPracticeSynth,
  type PracticeBus,
  type PracticeSynth,
} from '@/audio/synth/practiceSynth';
import type { MusicalEvent } from './engine/arrangement';
import { LookaheadScheduler } from './engine/scheduler';
import { indexAtBeat, type Timeline } from './engine/timeline';
import {
  Transport,
  type PassInfo,
  type ScheduledSound,
  type TransportNotice,
  type TransportPhase,
  type TransportSettings,
} from './engine/transport';
import type { Mix } from './practiceStore';
import type { SessionInput } from './sessionInput';

export type PracticeError = 'audio-unsupported' | 'audio-blocked';

/** What the screen shows; changes a few times per beat at most. */
export interface PracticeView {
  phase: TransportPhase;
  /** Position in beats at the last update. */
  beat: number;
  /** 0-based bar. */
  bar: number;
  /** Strum slot within the bar (0-based), for the beat counter. */
  slot: number;
  countIn: number | null;
  tempo: number;
  pass: number;
  /** Current chord segment and note (-1 before the first). */
  chordIndex: number;
  noteIndex: number;
}

export interface PracticeSessionConfig {
  timeline: Timeline;
  events: readonly MusicalEvent[];
  settings: TransportSettings;
  mix: Mix;
  a4: number;
  /** Called when speed-up changes the tempo, so it can be saved. */
  onTempoChange: (tempo: number) => void;
  onNotice?: (notice: TransportNotice) => void;
  /** Listening alongside playback (scoring or calibration); may change between renders. */
  input?: SessionInput | null;
}

export interface PracticeSession {
  view: PracticeView;
  error: PracticeError | null;
  /** True between a play tap and the first sound (audio may need to start). */
  starting: boolean;
  /** Calls `listener` with the position in beats on every animation frame while moving. */
  subscribe: (listener: (beat: number) => void) => () => void;
  /** Starts or resumes. Call from a tap/click handler (iOS needs the gesture). */
  play: () => void;
  pause: () => void;
  restart: () => void;
  /** Wait mode: carry on past the chord or note being waited for. */
  next: () => void;
}

const RESUME_TIMEOUT_MS = 1500;
/** Audio is held this long after stopping, so the screen catches up with what was heard. */
const RELEASE_DELAY_MS = 600;
const BUSES: readonly PracticeBus[] = ['metronome', 'guide', 'backing'];

function outputDelay(context: AudioContext): number {
  const latency = (context.outputLatency || 0) + (context.baseLatency || 0);
  return Number.isFinite(latency) ? latency : 0;
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

function viewKey(view: PracticeView): string {
  const { phase, bar, slot, countIn, tempo, pass, chordIndex, noteIndex } = view;
  return `${phase}|${bar}|${slot}|${countIn ?? ''}|${tempo}|${pass}|${chordIndex}|${noteIndex}`;
}

function guideMidis(events: readonly MusicalEvent[]): number[] {
  return events.flatMap((event) => {
    if (event.kind === 'strum') return event.midis.flatMap((midi) => (midi === null ? [] : [midi]));
    return event.kind === 'note' ? [event.midi] : [];
  });
}

/**
 * Runs a practice session: the transport on the shared AudioContext's clock,
 * the lookahead scheduler feeding the practice synth, and a frame loop that
 * reports the position as heard (audio clock minus output latency).
 */
export function usePracticeSession(config: PracticeSessionConfig): PracticeSession {
  const { timeline, events, settings } = config;
  const inputRef = useRef<SessionInput | null>(config.input ?? null);
  const [transport] = useState(
    () =>
      new Transport(
        {
          beatsPerBar: timeline.beatsPerBar,
          totalBeats: timeline.totalBeats,
          events,
          targets: timeline.targets,
        },
        settings,
      ),
  );
  const describe = useCallback(
    (time: number): PracticeView => {
      const snapshot = transport.snapshotAt(time);
      const { beatsPerBar, slotsPerBeat, totalBars, totalBeats } = timeline;
      const beat = Math.min(Math.max(snapshot.beat, 0), totalBeats - 1e-6);
      const bar = Math.min(Math.floor(beat / beatsPerBar), totalBars - 1);
      return {
        phase: snapshot.phase,
        beat: snapshot.beat,
        bar,
        slot: Math.floor((beat - bar * beatsPerBar) * slotsPerBeat + 1e-6),
        countIn: snapshot.countIn,
        tempo: snapshot.tempo,
        pass: snapshot.pass,
        chordIndex: indexAtBeat(timeline.chords, beat),
        noteIndex: indexAtBeat(timeline.notes, beat),
      };
    },
    [timeline, transport],
  );
  const [view, setView] = useState<PracticeView>(() => describe(0));
  const [error, setError] = useState<PracticeError | null>(null);
  const [starting, setStarting] = useState(false);

  const configRef = useRef(config);
  const leaseRef = useRef<AudioLease | null>(null);
  /** Kept after the lease is released: the paused position is read on its (stopped) clock. */
  const contextRef = useRef<AudioContext | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const synthRef = useRef<PracticeSynth | null>(null);
  const releaseTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const settleUntilRef = useRef(0);
  const viewKeyRef = useRef(viewKey(view));
  const listenersRef = useRef(new Set<(beat: number) => void>());
  const generationRef = useRef(0);
  const schedulerRef = useRef<LookaheadScheduler | null>(null);

  useEffect(() => {
    configRef.current = config;
    inputRef.current = config.input ?? null;
  });
  useEffect(() => {
    transport.setPassJudge((info: PassInfo) => inputRef.current?.judgePass?.(info) ?? true);
  }, [transport]);

  const now = useCallback(() => contextRef.current?.currentTime ?? 0, []);

  const publish = useCallback(() => {
    const context = contextRef.current;
    const next = describe(context ? context.currentTime - outputDelay(context) : 0);
    for (const listener of listenersRef.current) listener(next.beat);
    const key = viewKey(next);
    if (key !== viewKeyRef.current) {
      viewKeyRef.current = key;
      setView(next);
    }
  }, [describe]);

  /** Animates while playing, then for a moment longer so the display settles on what was heard. */
  const startFrames = useCallback(() => {
    settleUntilRef.current = performance.now() + RELEASE_DELAY_MS;
    if (frameRef.current !== null) return;
    const frame = () => {
      publish();
      if (contextRef.current) inputRef.current?.update?.(contextRef.current.currentTime);
      const status = transport.status;
      const active = status === 'running' || status === 'waiting';
      frameRef.current =
        active || performance.now() < settleUntilRef.current ? requestAnimationFrame(frame) : null;
    };
    frameRef.current = requestAnimationFrame(frame);
  }, [publish, transport]);

  const playSound = useCallback((sound: ScheduledSound) => {
    const synth = synthRef.current;
    if (!synth) return;
    if (sound.kind === 'click') {
      synth.click(sound.time, sound);
      return;
    }
    const { event, time, duration } = sound;
    switch (event.kind) {
      case 'strum':
        synth.strum(time, { ...event, duration });
        break;
      case 'note':
        synth.note(time, { midi: event.midi, duration });
        break;
      case 'bass':
        synth.bass(time, { midi: event.midi, duration });
        break;
      case 'kick':
        synth.kick(time);
        break;
      case 'hat':
        synth.hat(time, event);
        break;
    }
  }, []);

  const releaseLater = useCallback(() => {
    if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = window.setTimeout(() => {
      releaseTimerRef.current = null;
      const status = transport.status;
      if (status === 'running' || status === 'waiting') return;
      detachRef.current?.();
      detachRef.current = null;
      leaseRef.current?.release();
      leaseRef.current = null;
    }, RELEASE_DELAY_MS);
  }, [transport]);

  const scheduler = useCallback((): LookaheadScheduler => {
    schedulerRef.current ??= new LookaheadScheduler({
      now,
      onTick: (until) => {
        const { sounds, notices } = transport.advance(until);
        sounds.forEach(playSound);
        inputRef.current?.scheduled(sounds, notices);
        for (const notice of notices) {
          if (notice.kind === 'pass' && notice.tempo !== notice.previousTempo) {
            configRef.current.onTempoChange(notice.tempo);
          }
          configRef.current.onNotice?.(notice);
        }
        if (transport.status !== 'running' && transport.status !== 'waiting') {
          schedulerRef.current?.stop();
          inputRef.current?.stop();
          startFrames();
          releaseLater();
        }
      },
    });
    return schedulerRef.current;
  }, [now, playSound, releaseLater, startFrames, transport]);

  /** A pause or restart can undo a speed-up scheduled but not yet heard: save that too. */
  const syncTempo = useCallback(() => {
    const { tempo } = transport.settings;
    if (tempo !== configRef.current.settings.tempo) configRef.current.onTempoChange(tempo);
  }, [transport]);

  const pause = useCallback(() => {
    generationRef.current++;
    setStarting(false);
    const time = now();
    transport.pause(time);
    syncTempo();
    synthRef.current?.silenceFrom(time);
    schedulerRef.current?.stop();
    inputRef.current?.cancel(time, 'pause');
    inputRef.current?.stop();
    startFrames();
    releaseLater();
  }, [now, releaseLater, startFrames, syncTempo, transport]);

  const start = useCallback(() => {
    if (transport.status === 'running' || transport.status === 'waiting') return;
    if (!isWebAudioSupported()) {
      setError('audio-unsupported');
      return;
    }
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    // Synchronous, before any await: keeps the user gesture iOS requires.
    if (!leaseRef.current) {
      const lease = acquireAudio();
      const { context } = lease;
      // iOS reports "interrupted" for calls and Siri; other browsers suspend.
      const onStateChange = () => {
        const status = transport.status;
        if (context.state !== 'running' && (status === 'running' || status === 'waiting')) {
          pause();
        }
      };
      context.addEventListener('statechange', onStateChange);
      detachRef.current = () => {
        context.removeEventListener('statechange', onStateChange);
      };
      leaseRef.current = lease;
      contextRef.current = context;
    }
    const lease = leaseRef.current;
    if (!synthRef.current) {
      const synth = createPracticeSynth(lease.context, { a4: configRef.current.a4 });
      for (const bus of BUSES) synth.setBus(bus, configRef.current.mix[bus]);
      synthRef.current = synth;
    }
    const generation = ++generationRef.current;
    setError(null);
    setStarting(true);
    const input = inputRef.current;
    const listening = input
      ? input.start(lease.context).then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);

    void (async () => {
      const [, inputReady] = await Promise.all([
        withTimeout(lease.resumed, RESUME_TIMEOUT_MS),
        listening,
      ]);
      if (generation !== generationRef.current) return;
      setStarting(false);
      if (!inputReady) {
        releaseLater();
        return;
      }
      if (lease.context.state !== 'running') {
        input?.stop();
        setError('audio-blocked');
        releaseLater();
        return;
      }
      // Render the guide's notes now (a few ms each, once per app run) rather than mid-play.
      synthRef.current?.prepare(guideMidis(configRef.current.events));
      transport.play(lease.context.currentTime);
      scheduler().start();
      startFrames();
    })();
  }, [pause, releaseLater, scheduler, startFrames, transport]);

  const restart = useCallback(() => {
    const time = now();
    transport.restart(time);
    syncTempo();
    synthRef.current?.silenceFrom(time);
    inputRef.current?.cancel(time, 'restart');
    if (transport.status !== 'running' && transport.status !== 'waiting') {
      schedulerRef.current?.stop();
      inputRef.current?.stop();
    }
    startFrames();
    publish();
  }, [now, publish, startFrames, syncTempo, transport]);

  const next = useCallback(() => {
    transport.advanceWait(now());
    inputRef.current?.waitEnded?.();
    schedulerRef.current?.tick();
    startFrames();
  }, [now, startFrames, transport]);

  const subscribe = useCallback((listener: (beat: number) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // Settings changes go to the transport, which applies them from the scheduling horizon.
  const { tempo, waitMode } = settings;
  const loopStart = settings.loop?.start ?? null;
  const loopEnd = settings.loop?.end ?? null;
  const speedUpStep = settings.speedUp?.step ?? null;
  const speedUpTarget = settings.speedUp?.target ?? null;
  useEffect(() => {
    transport.setTempo(tempo, now());
    publish();
  }, [now, publish, tempo, transport]);
  useEffect(() => {
    const loop = loopStart !== null && loopEnd !== null ? { start: loopStart, end: loopEnd } : null;
    transport.setLoop(loop, now());
    publish();
  }, [loopEnd, loopStart, now, publish, transport]);
  useEffect(() => {
    const speedUp =
      speedUpStep !== null && speedUpTarget !== null
        ? { step: speedUpStep, target: speedUpTarget }
        : null;
    transport.setSpeedUp(speedUp, now());
  }, [now, speedUpStep, speedUpTarget, transport]);
  useEffect(() => {
    transport.setWaitMode(waitMode, now());
    if (transport.status === 'running') schedulerRef.current?.start();
    startFrames();
  }, [now, startFrames, transport, waitMode]);

  const { mix } = config;
  useEffect(() => {
    for (const bus of BUSES) synthRef.current?.setBus(bus, mix[bus]);
  }, [mix]);

  // Pause when the app goes to the background.
  useEffect(() => {
    const onVisibilityChange = () => {
      const status = transport.status;
      if (document.visibilityState === 'hidden' && (status === 'running' || status === 'waiting')) {
        pause();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pause, transport]);

  useEffect(
    () => () => {
      generationRef.current++;
      schedulerRef.current?.stop();
      inputRef.current?.stop();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (releaseTimerRef.current !== null) window.clearTimeout(releaseTimerRef.current);
      synthRef.current?.dispose();
      synthRef.current = null;
      detachRef.current?.();
      leaseRef.current?.release();
      leaseRef.current = null;
    },
    [],
  );

  return { view, error, starting, subscribe, play: start, pause, restart, next };
}
