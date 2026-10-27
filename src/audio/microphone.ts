export type MicrophoneErrorKind =
  | 'insecure-context'
  | 'unsupported'
  | 'permission-denied'
  | 'not-found'
  | 'in-use'
  | 'disconnected'
  | 'unknown';

export class MicrophoneError extends Error {
  override readonly name = 'MicrophoneError';
  readonly kind: MicrophoneErrorKind;

  constructor(kind: MicrophoneErrorKind, options?: ErrorOptions) {
    super(`Microphone unavailable: ${kind}`, options);
    this.kind = kind;
  }
}

/**
 * Browser voice processing (echo cancellation, noise suppression, automatic
 * gain) distorts the pitch and level of an instrument, so it is all off.
 */
export const MICROPHONE_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
  },
  video: false,
};

/** Asks for the microphone; rejects with a MicrophoneError describing why it is unavailable. */
export async function openMicrophone(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new MicrophoneError('insecure-context');
  // `mediaDevices` is missing outside secure contexts and in old browsers.
  const devices = navigator.mediaDevices as MediaDevices | undefined;
  if (typeof devices?.getUserMedia !== 'function') throw new MicrophoneError('unsupported');
  try {
    return await devices.getUserMedia(MICROPHONE_CONSTRAINTS);
  } catch (error) {
    throw toMicrophoneError(error);
  }
}

/** Maps getUserMedia failures (names differ slightly between browsers) to a kind. */
export function toMicrophoneError(error: unknown): MicrophoneError {
  if (error instanceof MicrophoneError) return error;
  // Duck-typed: DOMException is not an Error subclass in every engine.
  const name =
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
      ? error.name
      : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new MicrophoneError('permission-denied', { cause: error });
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new MicrophoneError('not-found', { cause: error });
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new MicrophoneError('in-use', { cause: error });
    case 'TypeError':
      return new MicrophoneError('unsupported', { cause: error });
    default:
      return new MicrophoneError('unknown', { cause: error });
  }
}

/** Stops every track so the browser releases the microphone (and its indicator). */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
