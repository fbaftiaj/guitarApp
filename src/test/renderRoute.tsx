import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { createRoutes } from '@/app/routes';

/**
 * Renders the full app (shell + routes) at `path`.
 *
 * Uses the core `RouterProvider`: under Vitest, `react-router/dom` resolves to
 * a different build of the package than `react-router`, which would give the
 * provider and the hooks separate router contexts.
 */
export function renderRoute(path: string) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}
