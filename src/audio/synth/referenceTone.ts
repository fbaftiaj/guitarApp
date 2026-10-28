import { acquireAudio, type AudioLease } from '../context';
import { createPluckBank, type ToneTimbre } from './pluckBank';

export const REFERENCE_TONE_SECONDS = 2.5;
const OUTPUT_GAIN = 0.9;
const CACHE_LIMIT = 24;

export interface PlayingTone {
  /** Audio-clock time at which the tone has finished. */
  endsAt: number;
  stop(): void;
}

export interface ReferenceTonePlayer {
  /** Plays a plucked-string reference note, replacing any tone still ringing. */
  play(frequency: number, timbre: ToneTimbre): PlayingTone;
  stop(): void;
}

/**
 * Plays synthesized reference notes for tuning by ear. Rendered notes are
 * cached, so replaying a string costs nothing. `play` must be called from a
 * user gesture (it may need to start audio on iOS).
 */
export function createReferenceTonePlayer(
  acquire: () => AudioLease = acquireAudio,
): ReferenceTonePlayer {
  const bank = createPluckBank({ seconds: REFERENCE_TONE_SECONDS, limit: CACHE_LIMIT });
  let current: { stop(): void } | null = null;

  function stop() {
    current?.stop();
    current = null;
  }

  return {
    stop,
    play(frequency, timbre) {
      stop();
      const lease = acquire();
      const { context } = lease;
      const source = context.createBufferSource();
      source.buffer = bank.get(context, frequency, timbre);
      const gain = context.createGain();
      gain.gain.value = OUTPUT_GAIN;
      source.connect(gain);
      gain.connect(context.destination);

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        source.disconnect();
        gain.disconnect();
        lease.release();
      };
      source.onended = finish;
      source.start();

      const tone = {
        endsAt: context.currentTime + REFERENCE_TONE_SECONDS,
        stop: () => {
          try {
            source.stop();
          } catch {
            // Already stopped.
          }
          finish();
        },
      };
      current = tone;
      return tone;
    },
  };
}
