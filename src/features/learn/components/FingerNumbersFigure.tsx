const FINGERS = [
  { number: 1, name: 'Index', x: 52, top: 30 },
  { number: 2, name: 'Middle', x: 82, top: 18 },
  { number: 3, name: 'Ring', x: 112, top: 26 },
  { number: 4, name: 'Little', x: 142, top: 46 },
];

/** The fretting hand with its finger numbers. */
export function FingerNumbersFigure() {
  return (
    <figure>
      <svg
        viewBox="0 0 200 165"
        role="img"
        aria-label="A fretting hand with numbered fingers: 1 index, 2 middle, 3 ring, 4 little, and T for the thumb."
        className="mx-auto h-auto w-full max-w-60"
      >
        <g className="fill-surface-raised stroke-border-strong" strokeWidth={1.5}>
          <rect x={16} y={92} width={26} height={58} rx={13} transform="rotate(-32 29 121)" />
          {FINGERS.map(({ number, x, top }) => (
            <rect key={number} x={x} y={top} width={26} height={110 - top} rx={13} />
          ))}
          <rect x={48} y={88} width={124} height={70} rx={24} />
        </g>
        {[
          ...FINGERS.map(({ number, x, top }) => ({
            label: String(number),
            cx: x + 13,
            cy: top + 15,
          })),
          { label: 'T', cx: 24, cy: 106 },
        ].map(({ label, cx, cy }) => (
          <g key={label}>
            <circle cx={cx} cy={cy} r={10} className="fill-accent" />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              className="fill-accent-fg text-[12px] font-bold"
            >
              {label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          {FINGERS.map(({ number, name }) => (
            <li key={number}>
              <span className="font-bold text-accent-text">{number}</span> {name}
            </li>
          ))}
          <li>
            <span className="font-bold text-accent-text">T</span> Thumb
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
