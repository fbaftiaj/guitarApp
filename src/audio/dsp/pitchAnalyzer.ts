import { nextPowerOfTwo } from './fft';
import { McLeodPitchDetector } from './mpm';

/** One pitch estimate, as posted from the audio thread to the app. */
export interface PitchFrame {
  /** Audio-clock time (seconds) of the newest sample in the analysed window. */
  time: number;
  /** Fundamental frequency in Hz, or 0 when the window has no pitch. */
  frequency: number;
  /** MPM clarity of the estimate, 0–1 (0 when there is none). */
  clarity: number;
  /** RMS level of the window, linear 0–1. */
  rms: number;
}

export interface DetectionRange {
  minFrequency: number;
  maxFrequency: number;
}

export interface AnalysisSettings {
  /** Samples per analysis window. */
  windowSize: number;
  /** Samples between consecutive estimates. */
  hopSize: number;
}

const MIN_WINDOW_SIZE = 2048;
const TARGET_HOP_SECONDS = 0.01;
/** Below about −80 dBFS a window is treated as silence and not analysed. */
const SILENCE_RMS = 1e-4;

/**
 * Window: the smallest power of two ≥ 2048 that spans two periods of the
 * lowest frequency (2048 samples for guitar, 4096 for bass at 44.1/48 kHz).
 * Hop: about 10 ms, between a quarter and a half of the window.
 */
export function analysisSettings(
  sampleRate: number,
  { minFrequency }: Pick<DetectionRange, 'minFrequency'>,
): AnalysisSettings {
  const longestPeriod = Math.ceil(sampleRate / minFrequency);
  const windowSize = Math.max(MIN_WINDOW_SIZE, nextPowerOfTwo(2 * longestPeriod));
  const hopSize = Math.min(
    windowSize / 2,
    Math.max(windowSize / 4, nextPowerOfTwo(TARGET_HOP_SECONDS * sampleRate)),
  );
  return { windowSize, hopSize };
}

/**
 * Turns a stream of audio blocks (e.g. 128-sample render quanta) into pitch
 * frames, one per hop over a sliding window. Allocation-free after
 * construction apart from the emitted frame objects.
 */
export class StreamingPitchAnalyzer {
  readonly settings: AnalysisSettings;
  private readonly sampleRate: number;
  private readonly detector: McLeodPitchDetector;
  private readonly ring: Float32Array;
  private readonly window: Float32Array;
  private writeIndex = 0;
  private filled = 0;
  private sinceLastAnalysis = 0;

  constructor(sampleRate: number, range: DetectionRange) {
    this.sampleRate = sampleRate;
    this.settings = analysisSettings(sampleRate, range);
    const { windowSize } = this.settings;
    this.detector = new McLeodPitchDetector({ sampleRate, windowSize, ...range });
    this.ring = new Float32Array(windowSize);
    this.window = new Float32Array(windowSize);
  }

  /**
   * Feeds a block of samples that starts at `blockStartTime` (audio-clock
   * seconds) and calls `emit` for every completed hop.
   */
  push(block: Float32Array, blockStartTime: number, emit: (frame: PitchFrame) => void): void {
    const { windowSize, hopSize } = this.settings;
    for (let i = 0; i < block.length; i++) {
      this.ring[this.writeIndex] = block[i] ?? 0;
      this.writeIndex = (this.writeIndex + 1) % windowSize;
      if (this.filled < windowSize) this.filled++;
      this.sinceLastAnalysis++;
      if (this.filled === windowSize && this.sinceLastAnalysis >= hopSize) {
        this.sinceLastAnalysis = 0;
        emit(this.analyse(blockStartTime + (i + 1) / this.sampleRate));
      }
    }
  }

  private analyse(time: number): PitchFrame {
    const { ring, window, writeIndex } = this;
    // Unroll the ring buffer, oldest sample first.
    window.set(ring.subarray(writeIndex));
    window.set(ring.subarray(0, writeIndex), ring.length - writeIndex);

    let sumOfSquares = 0;
    for (const sample of window) sumOfSquares += sample * sample;
    const rms = Math.sqrt(sumOfSquares / window.length);
    const estimate = rms >= SILENCE_RMS ? this.detector.detect(window) : null;
    return {
      time,
      frequency: estimate?.frequency ?? 0,
      clarity: estimate?.clarity ?? 0,
      rms,
    };
  }
}
