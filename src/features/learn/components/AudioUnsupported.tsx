import { ErrorState } from '@/ui/ErrorState';

export function AudioUnsupported() {
  return (
    <ErrorState
      title="Audio isn’t available"
      description="This browser can’t play the click track. Try a recent Chrome, Edge, Firefox or Safari."
    />
  );
}
