/**
 * AudioWorklet that runs all input analysis off the main thread: pitch
 * frames every ~10 ms, onsets, and the chroma after each onset. It posts
 * compact results; the app only does light bookkeeping.
 */
import { StreamingChroma, type ChromaEvent } from '../dsp/chroma';
import { StreamingOnsetDetector, type Onset } from '../dsp/onsetDetector';
import { StreamingPitchAnalyzer, type PitchFrame } from '../dsp/pitchAnalyzer';
import {
  ANALYSIS_PROCESSOR_NAME,
  type AnalysisCommand,
  type AnalysisFeatures,
  type AnalysisMessage,
  type AnalysisProcessorOptions,
} from './analysisProtocol';

/** The parts of AudioWorkletGlobalScope used here (TypeScript's DOM lib lacks them). */
interface ProcessorInstance {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

interface WorkletScope {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly AudioWorkletProcessor: new () => { readonly port: MessagePort };
  registerProcessor(
    name: string,
    processor: new (options: { processorOptions: AnalysisProcessorOptions }) => ProcessorInstance,
  ): void;
}

const scope = globalThis as unknown as WorkletScope;

class AnalysisProcessor extends scope.AudioWorkletProcessor implements ProcessorInstance {
  private pitch: StreamingPitchAnalyzer | null = null;
  private onsets: StreamingOnsetDetector | null = null;
  private chroma: StreamingChroma | null = null;
  private running = true;

  constructor({ processorOptions }: { processorOptions: AnalysisProcessorOptions }) {
    super();
    this.configure(processorOptions);
    this.port.onmessage = ({ data }: MessageEvent<AnalysisCommand>) => {
      if (data.type === 'configure') this.configure(data.features);
      else this.running = false;
    };
  }

  private configure({ pitch, onsets, chroma, a4 }: AnalysisFeatures): void {
    this.pitch = pitch ? new StreamingPitchAnalyzer(scope.sampleRate, pitch) : null;
    this.onsets = onsets ? new StreamingOnsetDetector(scope.sampleRate) : null;
    this.chroma = onsets && chroma ? new StreamingChroma(scope.sampleRate, a4) : null;
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) {
      const time = scope.currentTime;
      this.pitch?.push(channel, time, this.postPitch);
      this.onsets?.push(channel, time, this.postOnset);
      this.chroma?.push(channel, time, this.postChroma);
    }
    return this.running;
  }

  private post(message: AnalysisMessage): void {
    this.port.postMessage(message);
  }

  private readonly postPitch = (frame: PitchFrame): void => {
    this.post({ type: 'pitch', ...frame });
  };

  private readonly postOnset = (onset: Onset): void => {
    this.chroma?.capture(onset.time);
    this.post({ type: 'onset', ...onset });
  };

  private readonly postChroma = (event: ChromaEvent): void => {
    this.post({ type: 'chroma', ...event });
  };
}

scope.registerProcessor(ANALYSIS_PROCESSOR_NAME, AnalysisProcessor);
