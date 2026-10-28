/**
 * Calls `onTick(until)` every ~25 ms with the end of the window to fill
 * (~100 ms ahead of the audio clock). Sounds are then scheduled on the audio
 * clock with sample accuracy, so timer jitter and main-thread stalls shorter
 * than the lookahead never reach the ear.
 */

export const LOOKAHEAD_SECONDS = 0.1;
export const TICK_INTERVAL_MS = 25;

export interface Timers {
  setInterval: (callback: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

export interface LookaheadSchedulerOptions {
  /** The audio clock, in seconds. */
  now: () => number;
  onTick: (until: number) => void;
  lookaheadSeconds?: number;
  intervalMs?: number;
  timers?: Timers;
}

const browserTimers: Timers = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (id) => {
    window.clearInterval(id);
  },
};

export class LookaheadScheduler {
  private readonly options: Required<LookaheadSchedulerOptions>;
  private timer: number | null = null;

  constructor(options: LookaheadSchedulerOptions) {
    this.options = {
      lookaheadSeconds: LOOKAHEAD_SECONDS,
      intervalMs: TICK_INTERVAL_MS,
      timers: browserTimers,
      ...options,
    };
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Starts ticking; the first window is filled at once. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = this.options.timers.setInterval(() => {
      this.tick();
    }, this.options.intervalMs);
    this.tick();
  }

  stop(): void {
    if (this.timer === null) return;
    this.options.timers.clearInterval(this.timer);
    this.timer = null;
  }

  tick(): void {
    this.options.onTick(this.options.now() + this.options.lookaheadSeconds);
  }
}
