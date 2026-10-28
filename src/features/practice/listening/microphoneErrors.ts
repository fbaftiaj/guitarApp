import type { MicrophoneErrorKind } from '@/audio/microphone';

export type ListeningError = MicrophoneErrorKind | 'unknown';

export interface ListeningErrorCopy {
  title: string;
  description: string;
  /** False when trying again cannot help. */
  retry: boolean;
}

/** What to tell the player when listening could not start. */
export const LISTENING_ERRORS: Record<ListeningError, ListeningErrorCopy> = {
  'permission-denied': {
    title: 'Microphone access is blocked',
    description:
      'Allow microphone access for FretPath in your browser’s site settings, then try again.',
    retry: true,
  },
  'not-found': {
    title: 'No microphone found',
    description: 'Connect a microphone or headset, then try again.',
    retry: true,
  },
  'in-use': {
    title: 'The microphone is busy',
    description: 'Another app is using the microphone. Close it, then try again.',
    retry: true,
  },
  disconnected: {
    title: 'The microphone disconnected',
    description: 'It stopped sending sound. Check that it is connected, then try again.',
    retry: true,
  },
  'insecure-context': {
    title: 'Listening needs a secure connection',
    description: 'Browsers only allow the microphone on secure pages. Open FretPath over https://.',
    retry: false,
  },
  unsupported: {
    title: 'This browser can’t use the microphone',
    description: 'Use a current version of Chrome, Safari, Firefox or Edge.',
    retry: false,
  },
  unknown: {
    title: 'Listening couldn’t start',
    description: 'Something went wrong while starting the microphone. Try again.',
    retry: true,
  },
};
