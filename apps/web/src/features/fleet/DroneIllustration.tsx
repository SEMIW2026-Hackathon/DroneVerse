import { DRONE_CENTER, rotorLayout, type RotorCount } from '../../lib/droneShape';

// Greens from the app palette (Tailwind emerald 50-800).
const ARM = '#047857';
const BODY = '#059669';
const ROTOR_FILL = '#d1fae5';
const ROTOR_STROKE = '#10b981';
const LENS = '#ecfdf5';

/** Simple top-down drone with the right number of rotors. Decorative. */
export function DroneIllustration({
  rotors,
  className,
}: {
  rotors: RotorCount;
  className?: string;
}) {
  const layout = rotorLayout(rotors);
  const c = DRONE_CENTER;

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${rotors}-rotor drone`}
      className={className}
    >
      {layout.map((p, i) => (
        <line
          key={`arm-${i}`}
          x1={c}
          y1={c}
          x2={p.x}
          y2={p.y}
          stroke={ARM}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      {layout.map((p, i) => (
        <g key={`rotor-${i}`} data-rotor>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={ROTOR_FILL}
            stroke={ROTOR_STROKE}
            strokeWidth={2}
          />
          <line
            x1={p.x - p.r * 0.8}
            y1={p.y}
            x2={p.x + p.r * 0.8}
            y2={p.y}
            stroke={ARM}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <circle cx={p.x} cy={p.y} r={2} fill={ARM} />
        </g>
      ))}
      <rect x={c - 13} y={c - 11} width={26} height={22} rx={9} fill={BODY} />
      <circle cx={c} cy={c + 3} r={4.5} fill={LENS} />
      <circle cx={c} cy={c + 3} r={2} fill={ARM} />
      <path d={`M ${c - 4} ${c - 11} L ${c} ${c - 17} L ${c + 4} ${c - 11} Z`} fill={ARM} />
    </svg>
  );
}
