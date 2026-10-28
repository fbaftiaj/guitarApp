import { Headphones, Timer } from 'lucide-react';
import { LATENCY_PATH } from '@/app/navigation';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Switch } from '@/ui/Switch';
import type { ListeningError } from '../listening/microphoneErrors';
import { MicrophoneAlert } from './MicrophoneAlert';

interface ListeningPanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  latencyMs: number | null;
  error: ListeningError | null;
  onRetry: () => void;
}

/** Turns scoring with the microphone on or off, with latency status and microphone errors. */
export function ListeningPanel({
  enabled,
  onEnabledChange,
  latencyMs,
  error,
  onRetry,
}: ListeningPanelProps) {
  return (
    <div>
      <Switch
        label="Listen and score"
        description="Uses the microphone to judge each strum or note. Nothing is recorded or sent."
        checked={enabled}
        onChange={onEnabledChange}
      />
      {enabled && error && (
        <MicrophoneAlert error={error} onRetry={onRetry} className="mt-2">
          <Button
            variant="secondary"
            onClick={() => {
              onEnabledChange(false);
            }}
          >
            Play without listening
          </Button>
        </MicrophoneAlert>
      )}
      {enabled && !error && (
        <div className="mt-1 space-y-2 text-sm text-fg-muted">
          <p className="flex items-center justify-between gap-3">
            <span>
              {latencyMs === null ? 'Timing not calibrated yet' : `Latency ${latencyMs} ms`}
            </span>
            <ButtonLink to={LATENCY_PATH} variant="ghost" icon={Timer} className="-mr-2 shrink-0">
              {latencyMs === null ? 'Calibrate' : 'Recalibrate'}
            </ButtonLink>
          </p>
          <p className="flex gap-2 text-pretty">
            <Headphones aria-hidden className="mt-0.5 size-4 shrink-0" />
            With the speaker on, FretPath can hear its own clicks. Wired headphones, or a lower
            volume, give the fairest scores.
          </p>
        </div>
      )}
    </div>
  );
}
