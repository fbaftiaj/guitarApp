import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settingsStore';
import { THEME_COLORS } from './brand';
import { LIGHT_SCHEME_QUERY, applyTheme, resolveTheme } from './theme';
import { useThemeSync } from './useThemeSync';

function themeColorMeta(): HTMLMetaElement {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  return meta;
}

/** Minimal controllable `matchMedia` for the light-scheme query. */
function mockSystemScheme(initiallyLight: boolean) {
  let matches = initiallyLight;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === LIGHT_SCHEME_QUERY && matches;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    set(light: boolean) {
      matches = light;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

describe('resolveTheme', () => {
  it.each([
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['light', false, 'light'],
    ['system', false, 'dark'],
    ['system', true, 'light'],
  ] as const)('%s with system light=%s resolves to %s', (preference, prefersLight, expected) => {
    expect(resolveTheme(preference, prefersLight)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('sets the theme attribute and the browser chrome colour', () => {
    const meta = themeColorMeta();

    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(meta.content).toBe(THEME_COLORS.light);

    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(meta.content).toBe(THEME_COLORS.dark);
  });
});

describe('useThemeSync', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('applies the chosen theme and follows changes to the setting', () => {
    renderHook(useThemeSync);
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => {
      useSettingsStore.getState().setTheme('light');
    });
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('follows the operating system in "system" mode', () => {
    const system = mockSystemScheme(false);
    useSettingsStore.setState({ theme: 'system' });

    renderHook(useThemeSync);
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => {
      system.set(true);
    });
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
