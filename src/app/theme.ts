import { THEME_COLORS } from './brand';

export const THEME_PREFERENCES = ['dark', 'light', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = keyof typeof THEME_COLORS;

export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersLight: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}

export function systemPrefersLight(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_SCHEME_QUERY).matches;
}

/** Applies the theme to <html> and the browser chrome (status bar / title bar). */
export function applyTheme(theme: ResolvedTheme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}
