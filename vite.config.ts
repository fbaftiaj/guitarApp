/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { THEME_COLORS } from './src/app/brand.ts';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

function pwa(): PluginOption {
  return VitePWA({
    // The app shows its own "update available" prompt (src/app/pwa) so a new
    // version never reloads the page in the middle of a practice session.
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
    manifest: {
      id: '/',
      name: 'FretPath — Learn Guitar',
      short_name: 'FretPath',
      description:
        'Tune, learn and practise guitar: a precision tuner, a structured course and interactive play-along practice.',
      lang: 'en',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: THEME_COLORS.dark,
      theme_color: THEME_COLORS.dark,
      categories: ['education', 'music'],
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
      // iOS fetches its splash screen itself at launch; precaching every
      // device size would bloat the first install on all other devices.
      globIgnores: ['**/apple-splash-*.png'],
      navigateFallback: '/index.html',
      cleanupOutdatedCaches: true,
      // Take control of the page on first install so the first visit is
      // already offline-capable. Updates still wait for the user's go-ahead.
      clientsClaim: true,
    },
  });
}

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test';

  return {
    plugins: [react(), tailwindcss(), ...(isTest ? [] : [pwa()])],
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    resolve: {
      alias: {
        '@': srcDir,
        // The PWA plugin is disabled under Vitest, so its virtual module is
        // replaced by an inert stand-in.
        ...(isTest && {
          'virtual:pwa-register/react': `${srcDir}/test/mocks/pwaRegisterReact.ts`,
        }),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      unstubGlobals: true,
      // CSS is stubbed out in tests except the design tokens, which
      // designTokens.test.ts reads to verify contrast.
      css: { include: [/src\/index\.css/] },
    },
  };
});
