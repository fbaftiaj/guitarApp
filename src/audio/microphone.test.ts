import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MICROPHONE_CONSTRAINTS,
  MicrophoneError,
  openMicrophone,
  toMicrophoneError,
} from './microphone';

function domError(name: string): DOMException {
  return new DOMException('test', name);
}

describe('toMicrophoneError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['AbortError', 'in-use'],
    ['SomethingNew', 'unknown'],
  ])('maps %s to %s', (name, kind) => {
    const error = toMicrophoneError(domError(name));
    expect(error.kind).toBe(kind);
    expect(error.cause).toBeInstanceOf(DOMException);
  });

  it('maps a TypeError (no audio support) to unsupported', () => {
    expect(toMicrophoneError(new TypeError('bad constraints')).kind).toBe('unsupported');
  });
});

describe('openMicrophone', () => {
  beforeEach(() => {
    vi.stubGlobal('isSecureContext', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests raw audio, with voice processing off', async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    await expect(openMicrophone()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(MICROPHONE_CONSTRAINTS);
    expect(MICROPHONE_CONSTRAINTS.audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
  });

  it('explains a refused permission', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(domError('NotAllowedError')) },
    });

    await expect(openMicrophone()).rejects.toMatchObject({ kind: 'permission-denied' });
  });

  it('requires a secure context', async () => {
    vi.stubGlobal('isSecureContext', false);

    const error: unknown = await openMicrophone().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MicrophoneError);
    expect((error as MicrophoneError).kind).toBe('insecure-context');
  });

  it('reports browsers without microphone access', async () => {
    vi.stubGlobal('navigator', {});

    await expect(openMicrophone()).rejects.toMatchObject({ kind: 'unsupported' });
  });
});
