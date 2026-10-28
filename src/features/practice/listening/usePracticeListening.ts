import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise } from '@/content/exercises';
import { saveSession } from '@/storage/sessions';
import type { Timeline } from '../engine/timeline';
import {
  sessionRecord,
  summarize,
  summarizeWait,
  type SessionContext,
  type SessionSummary,
} from '../scoring/summary';
import type { ListeningError } from './microphoneErrors';
import { PracticeListening, type ListeningFeedback } from './practiceListening';

export interface PracticeListeningState {
  /** The session input, or null when listening is off. */
  input: PracticeListening | null;
  feedback: ListeningFeedback | null;
  /** Wait mode: wrong attempts at the chord or note awaited now. */
  wrongAttempts: number;
  /** Wait mode: counts chords or notes played right; the screen moves on when it changes. */
  waitSatisfied: number;
  error: ListeningError | null;
  clearError: () => void;
  /**
   * Ends the session: judges what is left, saves it (as practice unless a
   * context says otherwise) and returns the results (null if empty).
   */
  finish: (tempo: number, context?: SessionContext) => SessionSummary | null;
  /** Forgets the session (e.g. after a restart or once the results were shown). */
  reset: () => void;
}

/**
 * The practicer's listening state: scoring feedback for the screen, wait
 * mode advancing on the right chord or note, and the session results.
 */
export function usePracticeListening({
  timeline,
  exercise,
  enabled,
  waitMode,
  a4,
  latencyMs,
}: {
  timeline: Timeline;
  exercise: Exercise;
  enabled: boolean;
  waitMode: boolean;
  a4: number;
  latencyMs: number | null;
}): PracticeListeningState {
  const [feedback, setFeedback] = useState<ListeningFeedback | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [waitSatisfied, setWaitSatisfied] = useState(0);
  const [error, setError] = useState<ListeningError | null>(null);

  const input = useMemo(
    () =>
      enabled
        ? new PracticeListening({
            timeline,
            a4,
            latencyMs,
            waitMode: false,
            callbacks: {
              onFeedback: setFeedback,
              onWaitAttempt: (correct) => {
                if (!correct) setWrongAttempts((count) => count + 1);
              },
              onWaitSatisfied: () => {
                setWrongAttempts(0);
                setWaitSatisfied((count) => count + 1);
              },
              onWaitStarted: () => {
                setWrongAttempts(0);
              },
              onError: setError,
            },
          })
        : null,
    [enabled, timeline, a4, latencyMs],
  );

  useEffect(() => {
    input?.setWaitMode(waitMode);
  }, [input, waitMode]);

  useEffect(
    () => () => {
      input?.dispose();
    },
    [input],
  );

  const finish = useCallback(
    (tempo: number, context?: SessionContext): SessionSummary | null => {
      if (!input) return null;
      const hits = input.settle();
      const { startedAt, durationMs, startTime } = input.session;
      const stats = input.waitStats;
      const summary =
        stats.targets > 0
          ? summarizeWait(stats, { exercise, tempo })
          : hits.length > 0
            ? summarize(hits, { exercise, tempo, startTime })
            : null;
      if (summary && startedAt !== null) {
        const record = sessionRecord(summary, { exercise, tempo, startedAt, durationMs, context });
        saveSession(record).catch((cause: unknown) => {
          console.error('[practice] could not save the session', cause);
        });
      }
      return summary;
    },
    [exercise, input],
  );

  const reset = useCallback(() => {
    input?.reset();
    setFeedback(null);
  }, [input]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { input, feedback, wrongAttempts, waitSatisfied, error, clearError, finish, reset };
}
