import { Monitor, Moon, RotateCcw, Sun, Timer } from 'lucide-react';
import { LATENCY_PATH, WELCOME_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import type { ThemePreference } from '@/app/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { ButtonLink } from '@/ui/ButtonLink';
import { Card } from '@/ui/Card';
import { SegmentedControl, type SegmentedOption } from '@/ui/SegmentedControl';
import { ReferencePitchControl } from './ReferencePitchControl';

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsScreen() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const latencyMs = useSettingsStore((state) => state.latencyMs);

  return (
    <Screen title="Settings" backTo="/profile" backLabel="Back to profile">
      <div className="space-y-4">
        <Card>
          <h2 className="mb-4 text-base font-semibold">Appearance</h2>
          <SegmentedControl
            legend="Theme"
            name="theme"
            options={THEME_OPTIONS}
            value={theme}
            onChange={setTheme}
          />
        </Card>
        <Card>
          <h2 className="mb-4 text-base font-semibold">Tuning</h2>
          <ReferencePitchControl />
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Timing</h2>
          <p className="text-sm text-fg-muted">
            {latencyMs === null
              ? 'Latency not measured yet. Measure it so timing scores are fair on this device.'
              : `Measured latency: ${latencyMs} ms.`}
          </p>
          <ButtonLink to={LATENCY_PATH} variant="secondary" icon={Timer} className="mt-3">
            {latencyMs === null ? 'Measure latency' : 'Measure again'}
          </ButtonLink>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Setup</h2>
          <p className="text-sm text-pretty text-fg-muted">
            Choose a different starting stage, or go through the microphone, latency and tuning
            steps again.
          </p>
          <ButtonLink to={WELCOME_PATH} variant="secondary" icon={RotateCcw} className="mt-3">
            Run setup again
          </ButtonLink>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-semibold">About</h2>
          <dl className="flex justify-between text-sm">
            <dt className="text-fg-muted">Version</dt>
            <dd className="font-mono">{__APP_VERSION__}</dd>
          </dl>
        </Card>
      </div>
    </Screen>
  );
}
