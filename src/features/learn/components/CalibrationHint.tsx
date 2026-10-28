import { Timer } from 'lucide-react';
import { LATENCY_PATH } from '@/app/navigation';
import { useSettingsStore } from '@/stores/settingsStore';
import { ButtonLink } from '@/ui/ButtonLink';

/** Offers latency calibration before a scored run, until it has been done. */
export function CalibrationHint() {
  const calibrated = useSettingsStore((state) => state.latencyMs !== null);
  if (calibrated) return null;
  return (
    <p className="flex items-center justify-between gap-3 text-fg-muted">
      <span>Timing isn’t calibrated yet, so scores may be a little off.</span>
      <ButtonLink to={LATENCY_PATH} variant="ghost" icon={Timer} className="-mr-2 shrink-0">
        Calibrate
      </ButtonLink>
    </p>
  );
}
