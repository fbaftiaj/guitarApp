import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { AnalysisFeatures } from '@/audio/worklets/analysisProtocol';
import { vibrate } from '@/platform/haptics';
import { useWakeLock } from '@/platform/useWakeLock';
import { GUITAR_PITCH_RANGE } from '../practice/listening/practiceListening';
import { useMicrophone, type Microphone } from '../practice/listening/useMicrophone';
import { usePracticeTime } from '../practice/usePracticeTime';
import { TrainerJudge, type TrainerTarget } from './trainerJudge';
import type { TrainerStep } from './trainerPlan';
import {
  INITIAL_TRAINER_STATE,
  isFinished,
  trainerReducer,
  type TrainerEvent,
  type TrainerState,
} from './trainerState';

function targetOf(step: TrainerStep | undefined): TrainerTarget | null {
  if (!step) return null;
  return step.kind === 'string'
    ? { kind: 'note', midi: step.midi }
    : { kind: 'chord', chordId: step.chordId };
}

/** Input level as a 0–1 share of a 60 dB range, for the level bar. */
function levelOf(rms: number): number {
  if (rms <= 0) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(rms) + 60) / 60));
}

export interface Trainer {
  state: TrainerState;
  finished: boolean;
  microphone: Microphone;
  /** Calls `listener` with the input level (0–1) on every analysis frame. */
  subscribeLevel: (listener: (level: number) => void) => () => void;
  skip: () => void;
  restart: () => void;
}

/**
 * Runs a trainer plan: listens through the microphone, judges every attempt
 * against the current step and moves on when it is right. `plan` must not
 * change for the life of the component (key it by the plan).
 */
export function useTrainer(plan: readonly TrainerStep[], a4: number): Trainer {
  const [state, dispatch] = useReducer(
    (current: TrainerState, event: TrainerEvent) => trainerReducer(plan, current, event),
    INITIAL_TRAINER_STATE,
  );
  const [judge] = useState(
    () =>
      new TrainerJudge(a4, ({ correct, heard, time }) => {
        if (correct) vibrate(25);
        dispatch({ type: 'heard', correct, heard, at: time });
      }),
  );
  const [levelListeners] = useState(() => new Set<(level: number) => void>());
  const finished = isFinished(plan, state);
  const step = plan[state.step];

  useEffect(() => {
    judge.listenFor(targetOf(step));
  }, [judge, step]);

  const features = useMemo<AnalysisFeatures>(
    () => ({ pitch: GUITAR_PITCH_RANGE, onsets: true, chroma: true, a4 }),
    [a4],
  );
  const microphone = useMicrophone(features, {
    onOnset: (onset) => {
      judge.onset(onset);
    },
    onChroma: (event) => {
      judge.chroma(event);
    },
    onPitch: (frame) => {
      judge.pitch(frame);
      const level = levelOf(frame.rms);
      levelListeners.forEach((listener) => {
        listener(level);
      });
    },
  });

  const { stop } = microphone;
  useEffect(() => {
    if (finished) stop();
  }, [finished, stop]);

  const subscribeLevel = useCallback(
    (listener: (level: number) => void) => {
      levelListeners.add(listener);
      return () => {
        levelListeners.delete(listener);
      };
    },
    [levelListeners],
  );

  const listening = microphone.status === 'listening';
  useWakeLock(listening);
  usePracticeTime(listening);

  return {
    state,
    finished,
    microphone,
    subscribeLevel,
    skip: () => {
      dispatch({ type: 'skip' });
    },
    restart: () => {
      dispatch({ type: 'restart' });
    },
  };
}
