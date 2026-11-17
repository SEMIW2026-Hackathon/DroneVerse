import type { DroneSpec } from '@droneverse/shared';
import { DroneIllustration } from './DroneIllustration';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
      {children}
    </span>
  );
}

interface Props {
  drones: DroneSpec[];
  /** Cards become selectable when `onSelect` is given. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** "list" stacks one card per row (sidebars); "grid" flows into columns (full pages). */
  layout?: 'list' | 'grid';
}

/** "Choose your drone" cards, shared by the fleet page and the mission planner. */
export function DroneCards({ drones, selectedId, onSelect, layout = 'grid' }: Props) {
  return (
    <div
      className={
        layout === 'list' ? 'grid grid-cols-1 gap-3' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
      }
    >
      {drones.map((d) => {
        const selected = d.id === selectedId;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag
            key={d.id}
            type={onSelect ? 'button' : undefined}
            onClick={onSelect ? () => onSelect(d.id) : undefined}
            aria-pressed={onSelect ? selected : undefined}
            className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border-2 bg-white p-3 text-left shadow-sm ${
              selected ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-gray-100'
            }`}
          >
            <DroneIllustration rotors={d.rotors} className="h-20 w-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-emerald-900">{d.name}</div>
              <div className="truncate text-sm text-gray-500">{d.tagline}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip>⏱ {d.maxFlightMin} min</Chip>
                <Chip>⚡ {d.topSpeedKmh} km/h</Chip>
                <Chip>📷 {d.cameraMP} MP</Chip>
                <Chip>{d.rotors} rotors</Chip>
                <Chip>{d.sensor === 'rgb' ? 'RGB camera' : 'Multispectral'}</Chip>
              </div>
              {d.specsArePlaceholder && (
                <div className="mt-1.5 text-xs font-medium text-amber-700">
                  Placeholder specs, not measured
                </div>
              )}
            </div>
          </Tag>
        );
      })}
    </div>
  );
}
