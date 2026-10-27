import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/renderRoute';

describe('app navigation', () => {
  it('opens the tuner from the root path', async () => {
    const { router } = renderRoute('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tuner' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tuner');
    expect(document.title).toBe('Tuner · FretPath');
  });

  it('has one main navigation with the five tabs in thumb-reach order', async () => {
    renderRoute('/tuner');
    await screen.findByRole('heading', { level: 1, name: 'Tuner' });

    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      'Tuner',
      'Learn',
      'Practice',
      'Songs',
      'Profile',
    ]);
    expect(within(nav).getByRole('link', { name: 'Tuner' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches screens from the tab bar and moves focus to the new heading', async () => {
    const user = userEvent.setup();
    renderRoute('/tuner');
    await screen.findByRole('heading', { level: 1, name: 'Tuner' });

    for (const name of ['Learn', 'Practice', 'Songs', 'Profile']) {
      await user.click(screen.getByRole('link', { name }));

      const heading = await screen.findByRole('heading', { level: 1, name });
      expect(heading).toHaveFocus();
      expect(document.title).toBe(`${name} · FretPath`);
      expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    }
  });

  it('keeps the Profile tab active on the settings screen', async () => {
    const user = userEvent.setup();
    renderRoute('/profile');

    await user.click(await screen.findByRole('link', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows a not-found screen with a way back for unknown paths', async () => {
    const user = userEvent.setup();
    renderRoute('/no-such-page');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to the tuner' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tuner' })).toBeInTheDocument();
  });

  it('offers a skip link that moves focus to the main content', async () => {
    const user = userEvent.setup();
    renderRoute('/tuner');
    await screen.findByRole('heading', { level: 1, name: 'Tuner' });

    await user.click(screen.getByRole('link', { name: 'Skip to content' }));

    expect(screen.getByRole('main')).toHaveFocus();
  });
});
