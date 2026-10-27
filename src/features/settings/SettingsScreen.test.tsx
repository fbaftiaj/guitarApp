import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settingsStore';
import { renderRoute } from '@/test/renderRoute';

describe('SettingsScreen', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  it('switches the theme and applies it to the page', async () => {
    const user = userEvent.setup();
    renderRoute('/profile/settings');

    const dark = await screen.findByRole('radio', { name: 'Dark' });
    expect(dark).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('shows the app version and links back to the profile', async () => {
    renderRoute('/profile/settings');

    expect(await screen.findByText(__APP_VERSION__)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });
});
