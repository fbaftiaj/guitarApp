import { Navigate, type RouteObject } from 'react-router';
import { AppCrashScreen } from './AppCrashScreen';
import { AppLoadingScreen } from './AppLoadingScreen';
import { AppShell } from './AppShell';
import { HOME_PATH } from './navigation';
import { NotFoundScreen } from './NotFoundScreen';
import { RouteErrorScreen } from './RouteErrorScreen';

/**
 * Builds the route table. Feature screens are code-split so the first paint
 * only ships the shell; the service worker precaches every chunk for offline
 * use. A factory rather than a constant because the router mutates route
 * objects as it resolves `lazy`, so each router needs its own tree.
 */
export function createRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      Component: AppShell,
      ErrorBoundary: AppCrashScreen,
      HydrateFallback: AppLoadingScreen,
      children: [
        {
          // Pathless layout route: a failing screen keeps the navigation usable.
          // Screens use the function form of `lazy`: with the object form, the
          // router swallows a failed import and renders a blank screen instead
          // of this error boundary (react-router 7.18).
          ErrorBoundary: RouteErrorScreen,
          children: [
            { index: true, element: <Navigate to={HOME_PATH} replace /> },
            {
              path: 'tuner',
              lazy: async () => ({
                Component: (await import('@/features/tuner/TunerScreen')).TunerScreen,
              }),
            },
            {
              path: 'learn',
              lazy: async () => ({
                Component: (await import('@/features/learn/LearnScreen')).LearnScreen,
              }),
            },
            {
              path: 'practice',
              lazy: async () => ({
                Component: (await import('@/features/practice/PracticeScreen')).PracticeScreen,
              }),
            },
            {
              path: 'songs',
              lazy: async () => ({
                Component: (await import('@/features/songs/SongsScreen')).SongsScreen,
              }),
            },
            {
              path: 'profile',
              lazy: async () => ({
                Component: (await import('@/features/profile/ProfileScreen')).ProfileScreen,
              }),
            },
            {
              path: 'profile/settings',
              lazy: async () => ({
                Component: (await import('@/features/settings/SettingsScreen')).SettingsScreen,
              }),
            },
            { path: '*', Component: NotFoundScreen },
          ],
        },
      ],
    },
  ];
}
