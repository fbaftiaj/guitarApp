/**
 * Replaces getUserMedia in the page with a controllable test tone, so the
 * real tuner pipeline (AudioContext → AudioWorklet → detection → UI) runs on
 * a known signal. Install with `page.addInitScript(installFakeMicrophone)`.
 */

export interface FakeMicrophoneControls {
  setFrequency(hz: number): void;
  setLevel(level: number): void;
  /** The next getUserMedia call rejects with a DOMException of this name. */
  failNextWith(name: string): void;
  /** True while a fake microphone track is live. */
  isLive(): boolean;
  calls(): number;
  lastConstraints(): MediaStreamConstraints | undefined;
}

declare global {
  interface Window {
    fakeMicrophone: FakeMicrophoneControls;
  }
}

export function installFakeMicrophone(): void {
  let context: AudioContext | null = null;
  let oscillator: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let stream: MediaStream | null = null;
  let frequency = 110;
  let level = 0.3;
  let failure: string | null = null;
  let calls = 0;
  let constraints: MediaStreamConstraints | undefined;

  window.fakeMicrophone = {
    setFrequency(hz) {
      frequency = hz;
      oscillator?.frequency.setValueAtTime(hz, oscillator.context.currentTime);
    },
    setLevel(value) {
      level = value;
      gain?.gain.setValueAtTime(value, gain.context.currentTime);
    },
    failNextWith(name) {
      failure = name;
    },
    isLive: () => stream?.getAudioTracks().some((track) => track.readyState === 'live') ?? false,
    calls: () => calls,
    lastConstraints: () => constraints,
  };

  const getUserMedia = async (requested?: MediaStreamConstraints): Promise<MediaStream> => {
    calls++;
    constraints = requested;
    if (failure) {
      const name = failure;
      failure = null;
      throw new DOMException('Fake microphone failure', name);
    }
    context ??= new AudioContext();
    await context.resume();
    oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency;
    gain = context.createGain();
    gain.gain.value = level;
    const destination = context.createMediaStreamDestination();
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    stream = destination.stream;
    return stream;
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

declare global {
  interface Window {
    referenceTonesStarted: number;
  }
}

/** Counts started AudioBufferSourceNodes: the tuner's reference notes. */
export function installReferenceToneCounter(): void {
  window.referenceTonesStarted = 0;
  // Re-applied below with the node as `this`.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
    window.referenceTonesStarted++;
    start.apply(this, args);
  };
}
