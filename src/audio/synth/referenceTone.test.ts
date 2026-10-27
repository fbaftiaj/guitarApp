import { describe, expect, it, vi } from 'vitest';
import type { AudioLease } from '../context';
import { REFERENCE_TONE_SECONDS, createReferenceTonePlayer } from './referenceTone';

/** Just enough of an AudioContext for the player. */
function fakeAudio() {
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const buffersCreated = vi.fn();
  const context = {
    sampleRate: 48_000,
    currentTime: 10,
    destination: {},
    createBuffer: (channels: number, length: number, sampleRate: number) => {
      buffersCreated(channels, length, sampleRate);
      return { copyToChannel: vi.fn() };
    },
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        onended: null as (() => void) | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(() => source.onended?.()),
      };
      sources.push(source);
      return source;
    },
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
  };
  const release = vi.fn();
  const acquire = vi.fn((): AudioLease => ({
    context: context as unknown as AudioContext,
    resumed: Promise.resolve(),
    release,
  }));
  return { acquire, release, sources, buffersCreated };
}

describe('createReferenceTonePlayer', () => {
  it('plays a rendered pluck and reports when it ends', () => {
    const audio = fakeAudio();
    const player = createReferenceTonePlayer(audio.acquire);

    const tone = player.play(110, 'acoustic');

    expect(audio.sources[0]?.start).toHaveBeenCalled();
    expect(tone.endsAt).toBe(10 + REFERENCE_TONE_SECONDS);
    expect(audio.buffersCreated).toHaveBeenCalledWith(1, REFERENCE_TONE_SECONDS * 48_000, 48_000);
  });

  it('stops the previous tone and releases audio when a new one starts', () => {
    const audio = fakeAudio();
    const player = createReferenceTonePlayer(audio.acquire);

    player.play(110, 'acoustic');
    player.play(146.83, 'acoustic');

    expect(audio.sources[0]?.stop).toHaveBeenCalled();
    expect(audio.release).toHaveBeenCalledTimes(1);
  });

  it('renders each note once and reuses it', () => {
    const audio = fakeAudio();
    const player = createReferenceTonePlayer(audio.acquire);

    player.play(110, 'acoustic');
    player.play(110, 'acoustic');
    player.play(110, 'electric');

    expect(audio.buffersCreated).toHaveBeenCalledTimes(2);
  });

  it('releases audio exactly once when a tone ends by itself', () => {
    const audio = fakeAudio();
    const player = createReferenceTonePlayer(audio.acquire);

    const tone = player.play(110, 'bass');
    audio.sources[0]?.onended?.();
    tone.stop();

    expect(audio.release).toHaveBeenCalledTimes(1);
  });
});
