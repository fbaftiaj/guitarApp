// @vitest-environment node
import { describe, expect, it } from 'vitest';

/**
 * The tuner and the practicer share one audio stack. These checks keep Web
 * Audio code in `src/audio/`, so neither feature grows its own copy of the
 * context, microphone, synthesis or scheduling plumbing.
 */
const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

function filesMatching(pattern: RegExp): string[] {
  return Object.entries(sources)
    .filter(([, code]) => pattern.test(code))
    .map(([path]) => path)
    .sort();
}

describe('audio architecture', () => {
  it('finds the source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it('creates the AudioContext in one place', () => {
    expect(filesMatching(/new (webkit)?AudioContext\b/)).toEqual(['/src/audio/context.ts']);
  });

  it('opens the microphone in one place', () => {
    expect(filesMatching(/getUserMedia\s*\(/)).toEqual(['/src/audio/microphone.ts']);
  });

  it('keeps Web Audio node graphs inside src/audio', () => {
    const graphCode = filesMatching(
      /\.create(Oscillator|BufferSource|Gain|BiquadFilter|Buffer|MediaStreamSource)\s*\(|new AudioWorkletNode\b/,
    );
    expect(graphCode.length).toBeGreaterThan(0);
    for (const path of graphCode) expect(path).toMatch(/^\/src\/audio\//);
  });

  it('renders plucked strings only through the shared pluck bank', () => {
    expect(filesMatching(/\brenderPluck\s*\(/)).toEqual([
      '/src/audio/synth/karplusStrong.ts',
      '/src/audio/synth/pluckBank.ts',
    ]);
    expect(filesMatching(/\bcreatePluckBank\s*\(/)).toEqual([
      '/src/audio/synth/pluckBank.ts',
      '/src/audio/synth/practiceSynth.ts',
      '/src/audio/synth/referenceTone.ts',
    ]);
  });

  it('starts audio through the shared lease in both features', () => {
    expect(filesMatching(/\bacquireAudio\s*\(/)).toEqual(
      expect.arrayContaining([
        '/src/audio/context.ts',
        '/src/features/practice/usePracticeSession.ts',
        '/src/features/tuner/useTunerSession.ts',
      ]),
    );
  });
});
