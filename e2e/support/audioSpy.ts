/**
 * Records every oscillator and buffer source the app starts, with the
 * requested start time and the audio clock at the moment of the call, so
 * tests can check the practicer's timing on the real audio clock.
 */

export interface StartedSound {
  kind: 'oscillator' | 'buffer';
  type: string;
  frequency: number;
  /** Requested audio-clock start time. */
  when: number;
  /** Audio clock when `start()` was called. */
  calledAt: number;
}

declare global {
  interface Window {
    audioSpy: {
      started: StartedSound[];
      /** The audio clock of the most recently used context. */
      now: () => number;
    };
  }
}

/** Runs in the page before the app (`page.addInitScript`). */
export function installAudioSpy(): void {
  let context: BaseAudioContext | null = null;
  const started: StartedSound[] = [];
  window.audioSpy = { started, now: () => context?.currentTime ?? 0 };

  // Re-applied below with the node as `this`.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const startOscillator = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when = 0) {
    context = this.context;
    started.push({
      kind: 'oscillator',
      type: this.type,
      frequency: this.frequency.value,
      when,
      calledAt: this.context.currentTime,
    });
    startOscillator.call(this, when);
  };
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const startBuffer = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof startBuffer>) {
    context = this.context;
    started.push({
      kind: 'buffer',
      type: '',
      frequency: 0,
      when: args[0] ?? 0,
      calledAt: this.context.currentTime,
    });
    startBuffer.apply(this, args);
  };
}
