import type { Heard } from './trainerJudge';
import type { TrainerStep } from './trainerPlan';

export interface TrainerFeedback {
  correct: boolean;
  heard: Heard | null;
  /** The step this attempt was for (a right one has already moved on). */
  step: TrainerStep;
  /** Counts every attempt, so the same result twice still shows as new. */
  attempt: number;
}

export interface TrainerState {
  /** Index into the plan; equal to its length once finished. */
  step: number;
  /** Right strums so far on a strum step. */
  strums: number;
  feedback: TrainerFeedback | null;
  attempts: number;
  mistakes: number;
  /** Seconds between each right chord change and the one before it. */
  changeSeconds: readonly number[];
  /** When the last change was played right (seconds), for the next change's time. */
  lastChangeAt: number | null;
}

export type TrainerEvent =
  | { type: 'heard'; correct: boolean; heard: Heard | null; at: number }
  | { type: 'skip' }
  | { type: 'restart' };

export const INITIAL_TRAINER_STATE: TrainerState = {
  step: 0,
  strums: 0,
  feedback: null,
  attempts: 0,
  mistakes: 0,
  changeSeconds: [],
  lastChangeAt: null,
};

export function isFinished(plan: readonly TrainerStep[], state: TrainerState): boolean {
  return state.step >= plan.length;
}

/** The trainer's progress: right attempts move on, wrong ones are counted and explained. */
export function trainerReducer(
  plan: readonly TrainerStep[],
  state: TrainerState,
  event: TrainerEvent,
): TrainerState {
  if (event.type === 'restart') return INITIAL_TRAINER_STATE;
  const current = plan[state.step];
  if (!current) return state;
  if (event.type === 'skip') {
    return { ...state, step: state.step + 1, strums: 0, feedback: null, lastChangeAt: null };
  }

  const attempts = state.attempts + 1;
  const feedback = { correct: event.correct, heard: event.heard, step: current, attempt: attempts };
  if (!event.correct) return { ...state, attempts, mistakes: state.mistakes + 1, feedback };

  if (current.kind === 'strum' && state.strums + 1 < current.needed) {
    return { ...state, attempts, strums: state.strums + 1, feedback };
  }
  const moved = { ...state, attempts, step: state.step + 1, strums: 0, feedback };
  if (current.kind !== 'change') return moved;
  return {
    ...moved,
    changeSeconds:
      state.lastChangeAt === null
        ? state.changeSeconds
        : [...state.changeSeconds, event.at - state.lastChangeAt],
    lastChangeAt: event.at,
  };
}
