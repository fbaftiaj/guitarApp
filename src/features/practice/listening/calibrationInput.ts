import type { Listener } from '@/audio/listener';
import type { ScheduledSound, TransportNotice } from '../engine/transport';
import { analyzeCalibration, type CalibrationResult } from '../scoring/latency';
import type { SessionInput } from '../sessionInput';
import type { ListeningError } from './microphoneErrors';
import { CLOSE_DELAY_MS, openInput } from './openInput';

export interface CalibrationCallbacks {
  onError: (error: ListeningError) => void;
  /** Called once the last click has had time to be answered. */
  onResult: (result: CalibrationResult) => void;
  /** An onset was heard (to show the player they are being heard). */
  onHeard?: () => void;
}

/**
 * Latency calibration: records the scheduled times of the clicks after the
 * count-in and the onsets heard, then measures the typical offset.
 */
export class CalibrationInput implements SessionInput {
  private readonly callbacks: CalibrationCallbacks;
  private readonly a4: number;
  private listener: Listener | null = null;
  private clicks: number[] = [];
  private onsets: number[] = [];
  private finished = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(a4: number, callbacks: CalibrationCallbacks) {
    this.a4 = a4;
    this.callbacks = callbacks;
  }

  async start(context: AudioContext): Promise<void> {
    this.clearTimer();
    this.clicks = [];
    this.onsets = [];
    this.finished = false;
    this.listener ??= await openInput(
      context,
      {
        features: { pitch: null, onsets: true, chroma: false, a4: this.a4 },
        onOnset: ({ time }) => {
          this.onsets.push(time);
          this.callbacks.onHeard?.();
        },
        onEnded: () => {
          this.callbacks.onError('disconnected');
        },
      },
      this.callbacks.onError,
    );
  }

  scheduled(sounds: readonly ScheduledSound[], notices: readonly TransportNotice[]): void {
    for (const sound of sounds) {
      if (sound.kind === 'click' && !sound.countIn) this.clicks.push(sound.time);
    }
    if (notices.some((notice) => notice.kind === 'finished')) this.finished = true;
  }

  cancel(): void {
    this.finished = false;
  }

  stop(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.finished) {
        this.finished = false;
        this.callbacks.onResult(analyzeCalibration(this.clicks, this.onsets));
      }
      this.close();
    }, CLOSE_DELAY_MS);
  }

  close(): void {
    this.clearTimer();
    this.listener?.close();
    this.listener = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
