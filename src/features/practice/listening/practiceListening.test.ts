import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListenerOptions } from '@/audio/listener';
import { MicrophoneError } from '@/audio/microphone';
import { CHORDS } from '@/content/chords';
import { findExercise } from '@/content/exercises';
import { voicingTemplate } from '@/lib/music/chordTemplates';
import { arrange } from '../engine/arrangement';
import { compileExercise, type Timeline } from '../engine/timeline';
import type { ScheduledSound } from '../engine/transport';
import { PracticeListening, type ListeningCallbacks } from './practiceListening';

const listener = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  options: null as ListenerOptions | null,
}));

vi.mock('@/audio/listener', () => ({
  openListener: listener.open,
}));

function timelineOf(id: string): Timeline {
  const exercise = findExercise(id);
  if (!exercise) throw new Error(`missing ${id}`);
  return compileExercise(exercise);
}

/** The guide sounds of the first `beats` beats, as the transport schedules them from `start`. */
function guideSounds(timeline: Timeline, start: number, secondsPerBeat: number, beats: number) {
  return arrange(timeline)
    .filter((event) => event.part === 'guide' && event.beat < beats)
    .map((event): ScheduledSound => ({
      kind: 'music',
      time: start + event.beat * secondsPerBeat,
      duration: 0.5,
      event,
      pass: 1,
    }));
}

const context = { outputLatency: 0.02, baseLatency: 0.01 } as unknown as AudioContext;

function setup(
  id = 'em-am-changes',
  { waitMode = false, latencyMs = 50 }: { waitMode?: boolean; latencyMs?: number | null } = {},
) {
  const callbacks: ListeningCallbacks = {
    onFeedback: vi.fn(),
    onWaitAttempt: vi.fn(),
    onWaitSatisfied: vi.fn(),
    onError: vi.fn(),
  };
  const timeline = timelineOf(id);
  const listening = new PracticeListening({ timeline, a4: 440, latencyMs, waitMode, callbacks });
  return { listening, callbacks, timeline };
}

beforeEach(() => {
  listener.open.mockImplementation((_context: AudioContext, options: ListenerOptions) => {
    listener.options = options;
    return Promise.resolve({ configure: vi.fn(), close: listener.close });
  });
});

afterEach(() => {
  vi.useRealTimers();
  listener.open.mockReset();
  listener.close.mockReset();
  listener.options = null;
});

/** The player strums `chord` at `time` (heard 50 ms later, the calibrated latency). */
function strum(time: number, chord: string) {
  const onsetTime = time + 0.05;
  listener.options?.onOnset?.({ time: onsetTime, strength: 1 });
  listener.options?.onChroma?.({
    onsetTime,
    chroma: voicingTemplate(CHORDS.get(chord)?.midis ?? []),
  });
}

describe('PracticeListening', () => {
  it('listens for onsets and chroma on chord exercises, pitch on note exercises', async () => {
    await setup('em-am-changes').listening.start(context);
    expect(listener.options?.features).toMatchObject({ pitch: null, onsets: true, chroma: true });
    await setup('e-minor-riff').listening.start(context);
    expect(listener.options?.features).toMatchObject({ onsets: true, chroma: false });
    expect(listener.options?.features.pitch).not.toBeNull();
  });

  it('scores the guide strums as they are scheduled', async () => {
    const { listening, timeline, callbacks } = setup();
    await listening.start(context);
    listening.scheduled(guideSounds(timeline, 10, 0.5, 8), []);

    strum(10, 'Em');
    strum(10.5, 'Em');
    strum(11.07, 'Em');
    strum(12, 'Am');
    listening.update(20);

    const hits = listening.settle();
    expect(hits.map((hit) => [hit.timing, hit.correct, hit.target.label])).toEqual([
      ['perfect', true, 'Em'],
      ['perfect', true, 'Em'],
      ['good', true, 'Em'],
      ['miss', false, 'Em'],
      ['perfect', true, 'Am'],
      ['miss', false, 'Am'],
      ['miss', false, 'Am'],
      ['miss', false, 'Am'],
    ]);
    // Bar 2 starts with a chord change.
    expect(hits.map((hit) => hit.target.change)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(callbacks.onFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ accuracy: (1 + 1 + 0.85 + 1) / 8 }),
    );
    const marks =
      vi.mocked(callbacks.onFeedback).mock.lastCall?.[0].marks ?? new Map<number, string>();
    const byIndex = [...marks].sort(([a], [b]) => a - b).map(([, mark]) => mark);
    expect(byIndex).toEqual(['good', 'good', 'good', 'miss', 'good', 'miss', 'miss', 'miss']);
    expect(listening.session.startTime).toBe(10);
  });

  it('uses the estimated latency when none was measured', async () => {
    const { listening, timeline } = setup('em-am-changes', { latencyMs: null });
    await listening.start(context);
    listening.scheduled(guideSounds(timeline, 10, 0.5, 1), []);
    // Output 20 ms + base 10 ms + assumed input 12 ms.
    listener.options?.onOnset?.({ time: 10.042, strength: 1 });
    listening.update(20);
    expect(listening.settle()[0]?.deviation).toBeCloseTo(0, 9);
  });

  it('judges a loop pass by its accuracy', async () => {
    const { listening, timeline } = setup();
    await listening.start(context);
    listening.scheduled(guideSounds(timeline, 10, 0.5, 4), []);
    [10, 10.5, 11, 11.5].forEach((time) => {
      strum(time, 'Em');
    });
    expect(listening.judgePass({ pass: 1, endTime: 12 })).toBe(true);

    const second = setup();
    await second.listening.start(context);
    second.listening.scheduled(guideSounds(second.timeline, 10, 0.5, 4), []);
    strum(10, 'Em');
    second.listening.update(13);
    expect(second.listening.judgePass({ pass: 1, endTime: 12 })).toBe(false);
  });

  describe('wait mode', () => {
    it('waits for the chord, counts attempts and ignores the scheduled strums', async () => {
      const { listening, timeline, callbacks } = setup('em-am-changes', { waitMode: true });
      await listening.start(context);
      listening.scheduled(guideSounds(timeline, 10, 0.5, 4), [
        { kind: 'waiting', time: 10, beat: 0 },
      ]);
      strum(10.5, 'E');
      expect(callbacks.onWaitAttempt).toHaveBeenLastCalledWith(false);
      strum(11, 'Em');
      expect(callbacks.onWaitSatisfied).toHaveBeenCalledTimes(1);

      listening.scheduled([], [{ kind: 'waiting', time: 13, beat: 4 }]);
      strum(13.2, 'Am');
      expect(listening.waitStats).toEqual({ targets: 2, firstTry: 1 });
      expect(listening.settle()).toEqual([]);
    });

    it('does not count waiting at the same chord again after a pause as a new one', async () => {
      const { listening } = setup('em-am-changes', { waitMode: true });
      await listening.start(context);
      listening.scheduled([], [{ kind: 'waiting', time: 10, beat: 0 }]);
      listening.cancel(11, 'pause');
      listening.scheduled([], [{ kind: 'waiting', time: 20, beat: 0 }]);
      expect(listening.waitStats.targets).toBe(1);
    });
  });

  it('forgets the session on restart', async () => {
    const { listening, timeline } = setup();
    await listening.start(context);
    listening.scheduled(guideSounds(timeline, 10, 0.5, 4), []);
    strum(10, 'Em');
    listening.cancel(10.2, 'restart');
    expect(listening.settle()).toEqual([]);
    expect(listening.session.startedAt).toBeNull();
  });

  it('reports a microphone error and lets playback know it failed', async () => {
    listener.open.mockRejectedValueOnce(new MicrophoneError('permission-denied'));
    const { listening, callbacks } = setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(listening.start(context)).rejects.toThrow();
    expect(callbacks.onError).toHaveBeenCalledWith('permission-denied');
  });

  it('releases the microphone shortly after playback stops, unless it resumes', async () => {
    vi.useFakeTimers();
    const { listening } = setup();
    await listening.start(context);
    listening.stop();
    await vi.advanceTimersByTimeAsync(400);
    await listening.start(context);
    await vi.advanceTimersByTimeAsync(2000);
    expect(listener.close).not.toHaveBeenCalled();
    expect(listener.open).toHaveBeenCalledTimes(1);

    listening.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(listener.close).toHaveBeenCalledTimes(1);
  });
});
