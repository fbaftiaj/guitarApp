import type { DetectionRange } from '../dsp/pitchAnalyzer';

/** Messages between the pitch AudioWorklet and the main thread. */

export const PITCH_PROCESSOR_NAME = 'fretpath-pitch';

export type PitchProcessorOptions = DetectionRange;

export type PitchProcessorCommand = { type: 'configure'; range: DetectionRange } | { type: 'stop' };
