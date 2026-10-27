/**
 * AudioWorklet that runs pitch detection off the main thread. It posts one
 * compact PitchFrame per hop (~10 ms); the app only does light bookkeeping.
 */
import { StreamingPitchAnalyzer, type PitchFrame } from '../dsp/pitchAnalyzer';
import {
  PITCH_PROCESSOR_NAME,
  type PitchProcessorCommand,
  type PitchProcessorOptions,
} from './pitchProtocol';

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
    processor: new (options: { processorOptions: PitchProcessorOptions }) => ProcessorInstance,
  ): void;
}

const scope = globalThis as unknown as WorkletScope;

class PitchProcessor extends scope.AudioWorkletProcessor implements ProcessorInstance {
  private analyzer: StreamingPitchAnalyzer;
  private running = true;

  constructor({ processorOptions }: { processorOptions: PitchProcessorOptions }) {
    super();
    this.analyzer = new StreamingPitchAnalyzer(scope.sampleRate, processorOptions);
    this.port.onmessage = ({ data }: MessageEvent<PitchProcessorCommand>) => {
      if (data.type === 'configure') {
        this.analyzer = new StreamingPitchAnalyzer(scope.sampleRate, data.range);
      } else {
        this.running = false;
      }
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) this.analyzer.push(channel, scope.currentTime, this.post);
    return this.running;
  }

  private readonly post = (frame: PitchFrame): void => {
    this.port.postMessage(frame);
  };
}

scope.registerProcessor(PITCH_PROCESSOR_NAME, PitchProcessor);
