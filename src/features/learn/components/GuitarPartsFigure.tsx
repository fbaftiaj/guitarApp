/** Frets from the nut, getting closer together up the neck. */
const FRET_X = [60, 78, 95, 111, 126, 140, 153, 165, 176, 186, 195];
const MARKERS = [3, 5, 7, 9];
const STRING_Y = [66, 69.6, 73.2, 76.8, 80.4, 84];

const LABELS: readonly { text: string; x: number; y: number; to: [number, number] }[] = [
  { text: 'Headstock', x: 26, y: 14, to: [30, 56] },
  { text: 'Nut', x: 70, y: 14, to: [60, 62] },
  { text: 'Frets', x: 118, y: 14, to: [111, 62] },
  { text: 'Sound hole', x: 236, y: 14, to: [242, 62] },
  { text: 'Bridge', x: 318, y: 14, to: [306, 56] },
  { text: 'Tuning pegs', x: 34, y: 142, to: [33, 102] },
  { text: 'Neck', x: 140, y: 142, to: [140, 88] },
  { text: 'Strings', x: 196, y: 142, to: [212, 82] },
  { text: 'Body', x: 286, y: 142, to: [286, 120] },
];

/** A labelled guitar, for the first lesson. */
export function GuitarPartsFigure() {
  return (
    <figure>
      <svg
        viewBox="0 0 360 150"
        role="img"
        aria-label="A guitar with its parts labelled: the headstock with its tuning pegs, the nut, the neck with its frets, and the body with the sound hole, the bridge and the strings."
        className="h-auto w-full"
      >
        {/* Body: outline first, then the fill on top. */}
        <g className="fill-border-strong">
          <circle cx={232} cy={75} r={40} />
          <circle cx={292} cy={75} r={50} />
        </g>
        <g className="fill-surface-raised">
          <circle cx={232} cy={75} r={38.5} />
          <circle cx={292} cy={75} r={48.5} />
        </g>
        <circle cx={242} cy={75} r={13} className="fill-bg stroke-border-strong" strokeWidth={2} />
        <rect x={302} y={56} width={8} height={38} rx={2} className="fill-border-strong" />

        {/* Neck, frets and markers. */}
        <rect x={60} y={63} width={150} height={24} className="fill-border" />
        {FRET_X.map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={63}
            y2={87}
            className="stroke-fg-subtle"
            strokeWidth={1.2}
          />
        ))}
        {MARKERS.map((fret) => {
          const left = FRET_X[fret - 1] ?? 0;
          const right = FRET_X[fret] ?? 0;
          return (
            <circle key={fret} cx={(left + right) / 2} cy={75} r={2.2} className="fill-fg-subtle" />
          );
        })}

        {/* Headstock, pegs and nut. */}
        <path d="M60 62 L14 56 Q8 75 14 94 L60 88 Z" className="fill-border-strong" />
        {[20, 33, 46].map((x) => (
          <g key={x} className="fill-fg-subtle">
            <circle cx={x} cy={52} r={4.5} />
            <circle cx={x} cy={98} r={4.5} />
          </g>
        ))}
        <rect x={57} y={62} width={4} height={26} className="fill-fg" />

        {STRING_Y.map((y, i) => (
          <line
            key={y}
            x1={18}
            x2={306}
            y1={y}
            y2={y}
            className="stroke-fg-muted"
            strokeWidth={0.5 + (5 - i) * 0.15}
          />
        ))}

        {LABELS.map(({ text, x, y, to }) => (
          <g key={text}>
            <line
              x1={x}
              y1={y < 75 ? y + 4 : y - 11}
              x2={to[0]}
              y2={to[1]}
              className="stroke-accent"
              strokeWidth={0.8}
            />
            <text x={x} y={y} textAnchor="middle" className="fill-fg text-[10px] font-semibold">
              {text}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-fg-muted">
        The parts of an acoustic guitar. An electric has pickups where the sound hole is.
      </figcaption>
    </figure>
  );
}
