import { Monitor, Moon, Sun } from 'lucide-react';
import { Screen } from '@/app/Screen';
import type { ThemePreference } from '@/app/theme';
import { useSettingsStore } from '@/stores/settingsStore';
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
