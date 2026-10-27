import { acquireAudio, type AudioLease } from '../context';
import { renderPluck, type PluckOptions } from './karplusStrong';

export type ToneTimbre = 'acoustic' | 'electric' | 'bass' | 'nylon';

type TimbreSettings = Required<Pick<PluckOptions, 'brightness' | 'decaySeconds' | 'pickPosition'>>;

const TIMBRES: Record<ToneTimbre, TimbreSettings> = {
  acoustic: { brightness: 0.7, decaySeconds: 3.5, pickPosition: 0.18 },
  electric: { brightness: 0.45, decaySeconds: 5, pickPosition: 0.12 },
  bass: { brightness: 0.35, decaySeconds: 4, pickPosition: 0.22 },
  nylon: { brightness: 0.3, decaySeconds: 2.2, pickPosition: 0.25 },
};

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
  const buffers = new Map<string, AudioBuffer>();
  let current: { stop(): void } | null = null;

  function bufferFor(
    context: BaseAudioContext,
    frequency: number,
    timbre: ToneTimbre,
  ): AudioBuffer {
    const key = `${context.sampleRate}:${frequency.toFixed(3)}:${timbre}`;
    let buffer = buffers.get(key);
    if (buffer) {
      // Re-insert to keep the most recently used notes in the cache.
      buffers.delete(key);
    } else {
      const samples = renderPluck({
        frequency,
        sampleRate: context.sampleRate,
        durationSeconds: REFERENCE_TONE_SECONDS,
        ...TIMBRES[timbre],
      });
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      if (buffers.size >= CACHE_LIMIT) {
        const oldest = buffers.keys().next().value;
        if (oldest !== undefined) buffers.delete(oldest);
      }
    }
    buffers.set(key, buffer);
    return buffer;
  }

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
      source.buffer = bufferFor(context, frequency, timbre);
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
