// Geometry in SVG user units; pegs (HTML buttons) are positioned from the same numbers.
export const HEADSTOCK_WIDTH = 300;
const ROW = 52;
export const TOP = 20;
const NUT_GAP = 14;
export const NECK = 18;
const PEG_X = 40;
const POST_X = 112;

interface PegPosition {
  index: number;
  x: number;
  y: number;
  postX: number;
}

/**
 * Pegs as on a real headstock seen from the front: the first half of the
 * strings (thickest side) runs up the left from the nut, the rest down the
 * right — low E bottom-left and high e bottom-right on a 3+3 guitar.
 */
export function headstockLayout(count: number) {
  const leftCount = Math.ceil(count / 2);
  const height = TOP + leftCount * ROW + NUT_GAP + NECK;
  const nutY = TOP + leftCount * ROW + NUT_GAP;
  const pegs: PegPosition[] = Array.from({ length: count }, (_, index) => {
    const left = index < leftCount;
    const row = left ? leftCount - 1 - index : index - leftCount;
    return {
      index,
      x: left ? PEG_X : HEADSTOCK_WIDTH - PEG_X,
      y: TOP + row * ROW + ROW / 2,
      postX: left ? POST_X : HEADSTOCK_WIDTH - POST_X,
    };
  });
  const nutX = (index: number) => 130 + (count === 1 ? 20 : (index * 40) / (count - 1));
  return { height, nutY, pegs, nutX };
}
