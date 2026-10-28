import type { ChromaEvent } from './dsp/chroma';
import type { Onset } from './dsp/onsetDetector';
import type { PitchFrame } from './dsp/pitchAnalyzer';
import {
  ANALYSIS_PROCESSOR_NAME,
  type AnalysisCommand,
  type AnalysisFeatures,
  type AnalysisMessage,
} from './worklets/analysisProtocol';
import analysisProcessorUrl from './worklets/analysisProcessor.ts?worker&url';

const loadedModules = new WeakMap<BaseAudioContext, Promise<void>>();

function loadAnalysisProcessor(context: BaseAudioContext): Promise<void> {
  let loading = loadedModules.get(context);
  if (!loading) {
    loading = context.audioWorklet.addModule(analysisProcessorUrl);
    loadedModules.set(context, loading);
    // Allow a retry if loading failed (e.g. offline before the file was cached).
    loading.catch(() => loadedModules.delete(context));
  }
  return loading;
}

export interface AnalysisHandlers {
  onPitch?: (frame: PitchFrame) => void;
  onOnset?: (onset: Onset) => void;
  onChroma?: (event: ChromaEvent) => void;
}

export interface AnalysisInput {
  /** Changes what is analysed, e.g. the pitch range when the instrument changes. */
  configure(features: AnalysisFeatures): void;
  /** Detaches from the stream; results stop arriving. */
  disconnect(): void;
}

/** Analyses `stream` in an AudioWorklet and reports pitch frames, onsets and chroma. */
export async function connectAnalysisInput(
  context: AudioContext,
  stream: MediaStream,
  features: AnalysisFeatures,
  handlers: AnalysisHandlers,
): Promise<AnalysisInput> {
  await loadAnalysisProcessor(context);
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, ANALYSIS_PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
    processorOptions: features,
  });
  // Routing the (silent) output to the speakers keeps the node processing in
  // every browser; the zero gain makes sure nothing is heard.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(context.destination);
  node.port.onmessage = ({ data }: MessageEvent<AnalysisMessage>) => {
    switch (data.type) {
      case 'pitch':
        handlers.onPitch?.(data);
        break;
      case 'onset':
        handlers.onOnset?.(data);
        break;
      case 'chroma':
        handlers.onChroma?.(data);
        break;
    }
  };

  const send = (command: AnalysisCommand) => {
    node.port.postMessage(command);
  };
  return {
    configure: (next) => {
      send({ type: 'configure', features: next });
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
