import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settingsStore';
import { renderRoute } from '@/test/renderRoute';

describe('latency settings', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  it('links from the settings to the calibration', async () => {
    renderRoute('/profile/settings');
    expect(await screen.findByText(/Latency not measured yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Measure latency' })).toHaveAttribute(
      'href',
      '/profile/settings/latency',
    );
  });

  it('explains the calibration and starts it on a tap', async () => {
    renderRoute('/profile/settings/latency');
    expect(await screen.findByRole('heading', { level: 1, name: 'Latency' })).toBeInTheDocument();
    expect(screen.getByText(/Not measured yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(screen.getByText(/Bluetooth headphones add a long, variable delay/)).toBeInTheDocument();
  });

  it('shows and forgets a measured latency', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ latencyMs: 42 });
    renderRoute('/profile/settings/latency');

    expect(await screen.findByText('42 ms')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Forget the measured latency' }));
    expect(useSettingsStore.getState().latencyMs).toBeNull();
    expect(screen.getByText(/Not measured yet/)).toBeInTheDocument();
  });
});
