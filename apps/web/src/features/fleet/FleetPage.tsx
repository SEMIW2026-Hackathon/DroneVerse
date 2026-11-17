import { useEffect, useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { DroneCards } from './DroneCards';

export function FleetPage() {
  const { drones, load } = useFleetStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  return (
    <div className="mx-auto h-full max-w-4xl overflow-auto p-4">
      <h1 className="text-xl font-bold text-emerald-900">Your fleet</h1>
      <p className="mb-4 text-sm text-gray-600">
        These specs are placeholders until the real drones are chosen. Flight time, speed and camera
        numbers drive the battery and photo estimates in the mission planner.
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <DroneCards drones={drones} />
    </div>
  );
}
