import { renderPluck, type PluckOptions } from './karplusStrong';

/**
 * Rendered Karplus–Strong notes, cached as AudioBuffers. The tuner's reference
 * tones and the practicer's guide part both play plucks from a bank, so a note
 * is synthesised once and replayed for free.
 */

export type ToneTimbre = 'acoustic' | 'electric' | 'bass' | 'nylon';

type TimbreSettings = Required<Pick<PluckOptions, 'brightness' | 'decaySeconds' | 'pickPosition'>>;

export const TIMBRES: Record<ToneTimbre, TimbreSettings> = {
  acoustic: { brightness: 0.7, decaySeconds: 3.5, pickPosition: 0.18 },
  electric: { brightness: 0.45, decaySeconds: 5, pickPosition: 0.12 },
  bass: { brightness: 0.35, decaySeconds: 4, pickPosition: 0.22 },
  nylon: { brightness: 0.3, decaySeconds: 2.2, pickPosition: 0.25 },
};

export interface PluckBank {
  /** Length of every rendered note, in seconds. */
  readonly seconds: number;
  get(context: BaseAudioContext, frequency: number, timbre: ToneTimbre): AudioBuffer;
}

export function createPluckBank({ seconds, limit }: { seconds: number; limit: number }): PluckBank {
  const buffers = new Map<string, AudioBuffer>();
  return {
    seconds,
    get(context, frequency, timbre) {
      const key = `${context.sampleRate}:${frequency.toFixed(3)}:${timbre}`;
      let buffer = buffers.get(key);
      if (buffer) {
        // Re-insert to keep the most recently used notes in the cache.
        buffers.delete(key);
      } else {
        const samples = renderPluck({
          frequency,
          sampleRate: context.sampleRate,
          durationSeconds: seconds,
          ...TIMBRES[timbre],
        });
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.copyToChannel(samples, 0);
        if (buffers.size >= limit) {
          const oldest = buffers.keys().next().value;
          if (oldest !== undefined) buffers.delete(oldest);
        }
      }
      buffers.set(key, buffer);
      return buffer;
    },
  };
}
