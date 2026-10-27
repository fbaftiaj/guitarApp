import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/renderRoute';
import { RouteErrorScreen } from './RouteErrorScreen';

vi.mock('@/features/songs/SongsScreen', () => {
  throw new Error('Songs screen failed to initialise');
});

describe('RouteErrorScreen', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('replaces only the failing screen, keeping the navigation usable', async () => {
    renderRoute('/songs');

    expect(await screen.findByRole('alert')).toHaveTextContent('This screen hit a problem');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the tuner' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('explains a screen that failed to download', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        ErrorBoundary: RouteErrorScreen,
        lazy: () =>
          Promise.reject(
            new TypeError('Failed to fetch dynamically imported module: /assets/a.js'),
          ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('This screen couldn’t load');
  });
});
