import type { PassInfo, ScheduledSound, TransportNotice } from './engine/transport';

/**
 * The listening side of a practice session (scoring, or latency calibration).
 * The session drives it alongside playback, on the same audio clock.
 */
export interface SessionInput {
  /**
   * Called in the play tap, before playback starts: open the microphone.
   * Playback waits for it; a rejection cancels playing (the input shows why).
   */
  start(context: AudioContext): Promise<void>;
  /** Every batch of scheduled sounds, with their exact start times, and transport notices. */
  scheduled(sounds: readonly ScheduledSound[], notices: readonly TransportNotice[]): void;
  /** Playback stopped (pause) or jumped back (restart) at `time`: later sounds will not play. */
  cancel(time: number, reason: 'pause' | 'restart'): void;
  /** A wait-mode stop ended (Next, or the awaited chord was heard). */
  waitEnded?(): void;
  /** Playback has stopped: let late results arrive, then release the microphone. */
  stop(): void;
  /** Called every animation frame with the audio clock, to time out misses. */
  update?(now: number): void;
  /** Whether a loop pass earns a speed-up. */
  judgePass?(info: PassInfo): boolean;
}
