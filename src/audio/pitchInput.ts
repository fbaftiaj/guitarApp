import type { DetectionRange, PitchFrame } from './dsp/pitchAnalyzer';
import {
  PITCH_PROCESSOR_NAME,
  type PitchProcessorCommand,
  type PitchProcessorOptions,
} from './worklets/pitchProtocol';
import pitchProcessorUrl from './worklets/pitchProcessor.ts?worker&url';

const loadedModules = new WeakMap<BaseAudioContext, Promise<void>>();

function loadPitchProcessor(context: BaseAudioContext): Promise<void> {
  let loading = loadedModules.get(context);
  if (!loading) {
    loading = context.audioWorklet.addModule(pitchProcessorUrl);
    loadedModules.set(context, loading);
    // Allow a retry if loading failed (e.g. offline before the file was cached).
    loading.catch(() => loadedModules.delete(context));
  }
  return loading;
}

export interface PitchInput {
  /** Switches the detection range, e.g. when the instrument changes. */
  setRange(range: DetectionRange): void;
  /** Detaches from the stream; frames stop arriving. */
  disconnect(): void;
}

/** Runs pitch detection on `stream` in an AudioWorklet and reports each frame. */
export async function connectPitchInput(
  context: AudioContext,
  stream: MediaStream,
  range: DetectionRange,
  onFrame: (frame: PitchFrame) => void,
): Promise<PitchInput> {
  await loadPitchProcessor(context);
  const source = context.createMediaStreamSource(stream);
  const processorOptions: PitchProcessorOptions = range;
  const node = new AudioWorkletNode(context, PITCH_PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
    processorOptions,
  });
  // Routing the (silent) output to the speakers keeps the node processing in
  // every browser; the zero gain makes sure nothing is heard.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(context.destination);
  node.port.onmessage = (event: MessageEvent<PitchFrame>) => {
    onFrame(event.data);
  };

  const send = (command: PitchProcessorCommand) => {
    node.port.postMessage(command);
  };
  return {
    setRange: (next) => {
      send({ type: 'configure', range: next });
    },
    disconnect: () => {
      node.port.onmessage = null;
      send({ type: 'stop' });
      source.disconnect();
      node.disconnect();
      mute.disconnect();
    },
  };
}
