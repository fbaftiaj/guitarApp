import { Headphones, Timer } from 'lucide-react';
import { LATENCY_PATH } from '@/app/navigation';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';
import { Switch } from '@/ui/Switch';
import { LISTENING_ERRORS, type ListeningError } from '../listening/microphoneErrors';

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
  const copy = error ? LISTENING_ERRORS[error] : null;
  return (
    <div>
      <Switch
        label="Listen and score"
        description="Uses the microphone to judge each strum or note. Nothing is recorded or sent."
        checked={enabled}
        onChange={onEnabledChange}
      />
      {enabled && copy && (
        <div role="alert" className="mt-2 rounded-control border border-danger/50 bg-danger/10 p-3">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-1 text-sm text-fg-muted">{copy.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.retry && <Button onClick={onRetry}>Try again</Button>}
            <Button
              variant="secondary"
              onClick={() => {
                onEnabledChange(false);
              }}
            >
              Play without listening
            </Button>
          </div>
        </div>
      )}
      {enabled && !copy && (
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
