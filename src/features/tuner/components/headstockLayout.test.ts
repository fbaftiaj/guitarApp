// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HEADSTOCK_WIDTH, headstockLayout } from './headstockLayout';

function sides(count: number) {
  return headstockLayout(count).pegs.map((peg) => ({
    index: peg.index,
    side: peg.x < HEADSTOCK_WIDTH / 2 ? 'left' : 'right',
    y: peg.y,
  }));
}

describe('headstockLayout', () => {
  it('lays a 6-string out 3 + 3, low E bottom-left and high e bottom-right', () => {
    const pegs = sides(6);
    expect(pegs.map((peg) => peg.side)).toEqual([
      'left',
      'left',
      'left',
      'right',
      'right',
      'right',
    ]);

    const [lowE, a, d, g, b, highE] = pegs.map((peg) => peg.y);
    // Left side climbs away from the nut, right side comes back down to it.
    expect(lowE).toBeGreaterThan(a ?? Infinity);
    expect(a).toBeGreaterThan(d ?? Infinity);
    expect(g).toBeLessThan(b ?? -Infinity);
    expect(b).toBeLessThan(highE ?? -Infinity);
    expect(lowE).toBe(highE);
    expect(d).toBe(g);
  });

  it('puts the extra peg of odd counts on the bass side', () => {
    expect(sides(5).filter((peg) => peg.side === 'left')).toHaveLength(3);
    expect(sides(7).filter((peg) => peg.side === 'left')).toHaveLength(4);
  });

  it('keeps every peg above the nut and the strings spread across it', () => {
    const { pegs, nutY, nutX } = headstockLayout(12);
    expect(pegs.every((peg) => peg.y < nutY)).toBe(true);
    expect(nutX(0)).toBeLessThan(nutX(11));
  });
});
