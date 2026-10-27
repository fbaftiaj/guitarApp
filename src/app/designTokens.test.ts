import { describe, expect, it } from 'vitest';
import css from '../index.css?raw';
import { THEME_COLORS } from './brand';

/** Extracts `--color-*` hex values from a CSS block. */
function readColorTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`Missing CSS block: ${marker}`);
  return css.slice(start, css.indexOf('\n}', start));
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const dark = readColorTokens(blockAfter('@theme static'));
const light = { ...dark, ...readColorTokens(blockAfter(":root[data-theme='light']")) };

const TEXT_TOKENS = [
  'fg',
  'fg-muted',
  'fg-subtle',
  'accent-text',
  'sharp',
  'flat',
  'warning',
  'danger',
  'string-1',
  'string-2',
  'string-3',
  'string-4',
  'string-5',
  'string-6',
];
const SURFACES = ['bg', 'surface', 'surface-raised'];

describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme tokens', (_name, tokens) => {
  const color = (name: string): string => {
    const value = tokens[name];
    if (!value) throw new Error(`Missing token --color-${name}`);
    return value;
  };

  it.each(TEXT_TOKENS.flatMap((text) => SURFACES.map((surface) => [text, surface])))(
    '%s on %s meets WCAG AA for text (4.5:1)',
    (text, surface) => {
      expect(contrast(color(text), color(surface))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(['accent', 'accent-strong'])('accent-fg on %s meets WCAG AA for text', (fill) => {
    expect(contrast(color('accent-fg'), color(fill))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('browser chrome colours', () => {
  it('match the background token of each theme', () => {
    expect(dark.bg?.toLowerCase()).toBe(THEME_COLORS.dark.toLowerCase());
    expect(light.bg?.toLowerCase()).toBe(THEME_COLORS.light.toLowerCase());
  });
});
