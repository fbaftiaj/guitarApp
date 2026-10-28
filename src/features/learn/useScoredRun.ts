import { useCallback, useEffect, useMemo } from 'react';
import type { Exercise } from '@/content/exercises';
import { useWakeLock } from '@/platform/useWakeLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { arrange } from '../practice/engine/arrangement';
import { compileExercise, type Timeline } from '../practice/engine/timeline';
import {
  usePracticeListening,
  type PracticeListeningState,
} from '../practice/listening/usePracticeListening';
import { usePracticeStore, type LabelKey } from '../practice/practiceStore';
import { playThroughSettings } from '../practice/practiceView';
import type { SessionContext, SessionSummary } from '../practice/scoring/summary';
import { usePracticeSession, type PracticeSession } from '../practice/usePracticeSession';
import { usePracticeTime } from '../practice/usePracticeTime';

/** Results wait this long after the end, for the last strums' checks to come in. */
const RESULTS_DELAY_MS = 400;
const keepTempo = () => undefined;

export interface ScoredRun {
  exercise: Exercise;
  timeline: Timeline;
  session: PracticeSession;
  listening: PracticeListeningState;
  labels: Readonly<Record<LabelKey, boolean>>;
  fretboard: boolean;
  /** Starts or resumes; call from a tap. */
  play: () => void;
  restart: () => void;
}

/**
 * One scored play-through at the target tempo, listened to through the
 * microphone, as lesson checks and stage tests use it. The guide stays
 * silent so the microphone hears only the player. `onResult` gets the
 * results (already saved as a session with `context`) when the run ends.
 */
export function useScoredRun(
  exercise: Exercise,
  context: SessionContext,
  onResult: (summary: SessionSummary) => void,
): ScoredRun {
  const timeline = useMemo(() => compileExercise(exercise), [exercise]);
  const events = useMemo(() => arrange(timeline), [timeline]);
  const settings = useMemo(() => playThroughSettings(exercise.tempo), [exercise.tempo]);
  const mix = usePracticeStore((state) => state.mix);
  const labels = usePracticeStore((state) => state.labels);
  const fretboard = usePracticeStore((state) => state.fretboard);
  const a4 = useSettingsStore((state) => state.referencePitch);
  const latencyMs = useSettingsStore((state) => state.latencyMs);
  const scoredMix = useMemo(() => ({ ...mix, guide: { ...mix.guide, enabled: false } }), [mix]);

  const listening = usePracticeListening({
    timeline,
    exercise,
    enabled: true,
    waitMode: false,
    a4,
    latencyMs,
  });
  const session = usePracticeSession({
    timeline,
    events,
    settings,
    mix: scoredMix,
    a4,
    onTempoChange: keepTempo,
    input: listening.input,
  });
  const moving = session.view.phase === 'countIn' || session.view.phase === 'playing';
  useWakeLock(moving);
  usePracticeTime(moving);

  const { finish, reset: resetListening, clearError } = listening;
  const { mode, lessonId } = context;
  useEffect(() => {
    if (session.view.phase !== 'finished') return;
    const timer = window.setTimeout(() => {
      const summary = finish(exercise.tempo, { mode, lessonId });
      resetListening();
      if (summary) onResult(summary);
    }, RESULTS_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [exercise.tempo, finish, lessonId, mode, onResult, resetListening, session.view.phase]);

  const { restart: restartSession, play: playSession } = session;
  const restart = useCallback(() => {
    restartSession();
    resetListening();
  }, [resetListening, restartSession]);
  const play = useCallback(() => {
    clearError();
    playSession();
  }, [clearError, playSession]);

  return { exercise, timeline, session, listening, labels, fretboard, play, restart };
}
