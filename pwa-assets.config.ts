import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';
import { THEME_COLORS } from './src/app/brand.ts';

/**
 * Generates the PWA icons, favicon and iOS splash screens from the single
 * source logo. Run `npm run generate-pwa-assets` after changing the logo and
 * commit the output in `public/`. Paste the printed `apple-touch-startup-image`
 * links into `index.html` if the device list changes.
 */
const background = THEME_COLORS.dark;

const preset = combinePresetAndAppleSplashScreens(
  {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background, fit: 'contain' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background, fit: 'contain' } },
  },
  {
    padding: 0.35,
    resizeOptions: { background, fit: 'contain' },
    linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
  },
  [
    'iPhone 17 Pro Max',
    'iPhone 17 Pro',
    'iPhone Air',
    'iPhone 16 Plus',
    'iPhone 16',
    'iPhone 16e',
    'iPhone 13 mini',
    'iPhone SE 4.7"',
    'iPad Pro 12.9"',
    'iPad Pro 11"',
    'iPad Air 10.9"',
    'iPad 10.2"',
    'iPad mini 8.3"',
  ],
);

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/favicon.svg'],
});
