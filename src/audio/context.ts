/**
 * The app's single AudioContext. Browsers cap the number of contexts and each
 * one holds the audio hardware open, so every feature shares this one.
 */

let context: AudioContext | null = null;
let holders = 0;

export function isWebAudioSupported(): boolean {
  return typeof AudioContext === 'function' && 'audioWorklet' in AudioContext.prototype;
}

export function getAudioContext(): AudioContext {
  if (!context || context.state === 'closed') {
    context = new AudioContext({ latencyHint: 'interactive' });
  }
  return context;
}

export interface AudioLease {
  context: AudioContext;
  /**
   * Settles once starting has finished, successfully or not (it never
   * rejects): check `context.state` afterwards.
   */
  resumed: Promise<void>;
  /** Hands the context back; once nobody holds it, it is suspended to save battery. */
  release: () => void;
}

/**
 * Starts or resumes audio for the caller. Call it synchronously from a tap or
 * click handler: iOS only lets audio start inside a user gesture, and an
 * `await` before this call would lose the gesture.
 */
export function acquireAudio(): AudioLease {
  const ctx = getAudioContext();
  holders++;
  const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume().catch(() => undefined);
  let released = false;
  return {
    context: ctx,
    resumed,
    release: () => {
      if (released) return;
      released = true;
      holders--;
      if (holders === 0 && ctx.state === 'running') {
        ctx.suspend().catch(() => undefined);
      }
    },
  };
}
