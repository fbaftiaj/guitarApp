import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, useSettingsStore, whenSettingsHydrated } from '@/stores/settingsStore';
import { useProgressStore } from '@/stores/progressStore';
import { renderRoute } from '@/test/renderRoute';

describe('Onboarding', () => {
  beforeEach(async () => {
    await whenSettingsHydrated();
    useSettingsStore.setState(DEFAULT_SETTINGS);
    useProgressStore.setState({ lessons: {}, status: 'ready' });
  });

  it('places the player, explains the microphone, offers calibration and tuning', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/welcome');

    await screen.findByRole('heading', { name: 'Where are you starting from?' });
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /I’ve never played/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /I know a few chords/ }));
    expect(screen.getByText('Start at Stage 2: Open Chords I')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const micHeading = screen.getByRole('heading', { name: 'FretPath listens while you play' });
    expect(micHeading).toHaveFocus();
    expect(screen.getByText(/Nothing is recorded, stored or sent/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Make timing scores fair' })).toHaveFocus();
    expect(
      screen.getByRole('heading', { name: 'Measure your device’s delay' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(screen.getByRole('heading', { name: 'Tune your guitar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /start learning/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/learn');
    expect(useSettingsStore.getState()).toMatchObject({ onboarded: true, startStage: 2 });
    // Stage 2 is where the course carries on.
    expect(screen.getByRole('link', { name: 'Start the first lesson' })).toHaveAttribute(
      'href',
      '/learn/lesson/e-minor-chord/learn',
    );
  });

  it('can go back a step', async () => {
    const user = userEvent.setup();
    renderRoute('/welcome');
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Where are you starting from?' })).toHaveFocus();
  });

  it('can be skipped, starting at the beginning', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/welcome');
    await user.click(await screen.findByRole('button', { name: 'Skip setup' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tuner' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tuner');
    expect(useSettingsStore.getState()).toMatchObject({ onboarded: true, startStage: 1 });
  });

  it('runs again from Settings, remembering the starting stage', async () => {
    const user = userEvent.setup();
    useSettingsStore.setState({ onboarded: true, startStage: 3 });
    renderRoute('/profile/settings');
    await user.click(await screen.findByRole('link', { name: 'Run setup again' }));
    expect(await screen.findByRole('radio', { name: /I play regularly/ })).toBeChecked();
  });
});
