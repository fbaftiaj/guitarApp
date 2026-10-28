import { MIN_TEMPO, type Exercise } from '@/content/exercises';
import type { NewSessionResult, SkillId, StarCount } from '@/storage/types';
import { hitCredit, type Hit } from './scorer';
import { starsFor } from './stars';
import { TIMING_CREDIT, type Timing } from './timing';

export interface Suggestion {
  kind: 'slower' | 'again' | 'faster' | 'next';
  /** Tempo to try next, or null when the exercise is done. */
  tempo: number | null;
  text: string;
}

export interface SessionSummary {
  /** 0–1: full credit for right chords/notes played Perfect, 85 % for Good, half for Early/Late. */
  accuracy: number;
  stars: StarCount;
  total: number;
  counts: Record<Timing, number>;
  /** Played on time but the wrong chord or note. */
  wrong: number;
  /** Labels missed or played wrong most often, most first (top three). */
  mostMissed: { label: string; count: number }[];
  /** Misses and wrong chords or notes per label. */
  missedCounts: Record<string, number>;
  /** Every judged target, for the timing chart. */
  timeline: { time: number; deviationMs: number | null; timing: Timing; correct: boolean }[];
  /** Average timing of the hits: positive = behind the beat. */
  meanDeviationMs: number | null;
  skills: Partial<Record<SkillId, number>>;
  suggestion: Suggestion;
}

/** At or above this, move on (or speed up). */
const GOOD_ACCURACY = 0.85;
/** Below this, slow down. */
const PASS_ACCURACY = 0.7;
const TEMPO_STEP = 10;

function mean(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

export function suggestion(accuracy: number, tempo: number, targetTempo: number): Suggestion {
  if (accuracy < PASS_ACCURACY) {
    const slower = Math.max(MIN_TEMPO, Math.round((tempo * 0.85) / 5) * 5);
    return { kind: 'slower', tempo: slower, text: `Try again at ${slower} BPM` };
  }
  if (accuracy < GOOD_ACCURACY) {
    return { kind: 'again', tempo, text: `Try again at ${tempo} BPM to lock it in` };
  }
  if (tempo < targetTempo) {
    const faster = Math.min(targetTempo, tempo + TEMPO_STEP);
    return { kind: 'faster', tempo: faster, text: `Try again at ${faster} BPM` };
  }
  return { kind: 'next', tempo: null, text: 'Ready for the next lesson' };
}

/** Per-skill scores (0–1) from the hits, for the skills the exercise trains. */
function skillScores(hits: readonly Hit[], exercise: Exercise): Partial<Record<SkillId, number>> {
  const timing = mean(hits.map((hit) => TIMING_CREDIT[hit.timing]));
  const played = hits.filter((hit) => hit.timing !== 'miss');
  const rightness = mean(played.map((hit) => (hit.correct ? 1 : 0)));
  const changes = mean(hits.filter((hit) => hit.target.change).map(hitCredit));
  const overall = mean(hits.map(hitCredit));
  const scores: Partial<Record<SkillId, number | null>> = {
    rhythm: timing,
    strumming: exercise.kind === 'chords' ? timing : null,
    chords: exercise.kind === 'chords' ? (rightness ?? 0) : null,
    chordChanges: exercise.kind === 'chords' ? changes : null,
    singleNotes: exercise.kind === 'notes' ? overall : null,
    lead: exercise.kind === 'notes' ? overall : null,
    // Reading tab, diagrams and rhythms, shown by playing what they say.
    theory: overall,
  };
  const result: Partial<Record<SkillId, number>> = {};
  for (const skill of exercise.skills) {
    const score = scores[skill];
    if (score !== null && score !== undefined) result[skill] = score;
  }
  return result;
}

/** Results of a scored session: `hits` must be final, `startTime` is the audio clock at the start. */
export function summarize(
  hits: readonly Hit[],
  { exercise, tempo, startTime }: { exercise: Exercise; tempo: number; startTime: number },
): SessionSummary {
  const counts: Record<Timing, number> = { perfect: 0, good: 0, early: 0, late: 0, miss: 0 };
  const missed = new Map<string, number>();
  let wrong = 0;
  for (const hit of hits) {
    counts[hit.timing]++;
    if (hit.timing !== 'miss' && !hit.correct) wrong++;
    if (hit.timing === 'miss' || !hit.correct) {
      missed.set(hit.target.label, (missed.get(hit.target.label) ?? 0) + 1);
    }
  }
  const accuracy = mean(hits.map(hitCredit)) ?? 0;
  const deviations = hits.flatMap((hit) => (hit.deviation === null ? [] : [hit.deviation * 1000]));
  const meanDeviation = mean(deviations);
  return {
    accuracy,
    stars: starsFor(accuracy),
    total: hits.length,
    counts,
    wrong,
    mostMissed: [...missed]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 3),
    missedCounts: Object.fromEntries(missed),
    timeline: hits.map((hit) => ({
      time: hit.target.time - startTime,
      deviationMs: hit.deviation === null ? null : hit.deviation * 1000,
      timing: hit.timing,
      correct: hit.correct === true,
    })),
    meanDeviationMs: meanDeviation === null ? null : Math.round(meanDeviation),
    skills: skillScores(hits, exercise),
    suggestion: suggestion(accuracy, tempo, exercise.tempo),
  };
}

/**
 * Results of a wait-mode session: timing is not judged there, only whether
 * each chord or note was right the first time.
 */
export function summarizeWait(
  { targets, firstTry }: { targets: number; firstTry: number },
  { exercise, tempo }: { exercise: Exercise; tempo: number },
): SessionSummary {
  const accuracy = targets > 0 ? firstTry / targets : 0;
  const skill = exercise.kind === 'chords' ? 'chords' : 'singleNotes';
  return {
    accuracy,
    stars: starsFor(accuracy),
    total: targets,
    counts: { perfect: 0, good: firstTry, early: 0, late: 0, miss: targets - firstTry },
    wrong: 0,
    mostMissed: [],
    missedCounts: {},
    timeline: [],
    meanDeviationMs: null,
    skills: exercise.skills.includes(skill) ? { [skill]: accuracy } : {},
    suggestion: suggestion(accuracy, tempo, exercise.tempo),
  };
}

/** The record stored in IndexedDB for a finished practice session. */
/** How a session was played: free practice, or a lesson's check. */
export type SessionContext = Pick<NewSessionResult, 'mode' | 'lessonId'>;

export const PRACTICE_CONTEXT: SessionContext = { mode: 'practice', lessonId: null };

export function sessionRecord(
  summary: SessionSummary,
  {
    exercise,
    tempo,
    startedAt,
    durationMs,
    context = PRACTICE_CONTEXT,
  }: {
    exercise: Exercise;
    tempo: number;
    startedAt: number;
    durationMs: number;
    context?: SessionContext | undefined;
  },
): NewSessionResult {
  return {
    exerciseId: exercise.id,
    lessonId: context.lessonId,
    mode: context.mode,
    startedAt: Math.round(startedAt),
    durationMs: Math.max(0, Math.round(durationMs)),
    bpm: tempo,
    accuracy: Math.min(1, Math.max(0, summary.accuracy)),
    hits: summary.counts,
    skills: summary.skills,
    missed: summary.missedCounts,
  };
}
