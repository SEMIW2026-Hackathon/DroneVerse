import type { DroneSpec } from '@droneverse/shared';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
      {children}
    </span>
  );
}

interface Props {
  drones: DroneSpec[];
  /** Cards become selectable when `onSelect` is given. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

/** "Choose your drone" cards, shared by the fleet page and the mission planner. */
export function DroneCards({ drones, selectedId, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {drones.map((d) => {
        const selected = d.id === selectedId;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag
            key={d.id}
            type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(d.id) : undefined}
            aria-pressed={onSelect ? selected : undefined}
            className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm ${
              selected ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-transparent'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-emerald-900">{d.name}</div>
                <div className="text-sm text-gray-500">{d.tagline}</div>
              </div>
              <span className="text-xs text-gray-400">{d.rotors} rotors</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>⏱ {d.maxFlightMin} min</Chip>
              <Chip>⚡ {d.topSpeedKmh} km/h</Chip>
              <Chip>📷 {d.cameraMP} MP</Chip>
              <Chip>{d.sensor === 'rgb' ? 'RGB camera' : 'Multispectral'}</Chip>
            </div>
            {d.specsArePlaceholder && (
              <div className="mt-2 text-xs font-medium text-amber-700">
                Placeholder specs, not measured
              </div>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
