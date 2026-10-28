import type { ChromaEvent } from '../dsp/chroma';
import type { Onset } from '../dsp/onsetDetector';
import type { DetectionRange, PitchFrame } from '../dsp/pitchAnalyzer';

/** Messages between the analysis AudioWorklet and the main thread. */

export const ANALYSIS_PROCESSOR_NAME = 'fretpath-analysis';

/** What to analyse. The tuner needs pitch only; the practicer also onsets and chroma. */
export interface AnalysisFeatures {
  /** Pitch detection range, or null for no pitch frames. */
  pitch: DetectionRange | null;
  onsets: boolean;
  /** Chroma after each onset (needs `onsets`). */
  chroma: boolean;
  /** Reference pitch for chroma, in Hz. */
  a4: number;
}

export type AnalysisProcessorOptions = AnalysisFeatures;

export type AnalysisCommand = { type: 'configure'; features: AnalysisFeatures } | { type: 'stop' };

export type AnalysisMessage =
  | ({ type: 'pitch' } & PitchFrame)
  | ({ type: 'onset' } & Onset)
  | ({ type: 'chroma' } & ChromaEvent);
