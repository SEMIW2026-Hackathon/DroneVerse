import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Map } from 'maplibre-gl';
import { PLAN_CONFIG } from '@droneverse/shared';
import { formatHa } from '../../lib/format';
import { useFarmStore } from '../../store/useFarmStore';
import { FieldForm } from './FieldForm';
import { FieldMap } from './FieldMap';
import { useDrawing } from './useDrawing';

type Mode = 'browse' | 'drawing' | 'naming';

export function FarmDetailPage() {
  const { farmId = '' } = useParams();
  const { farms, fields: allFields, loadFarms, loadFields, addField, removeField } = useFarmStore();
  const [map, setMap] = useState<Map | null>(null);
  const [mode, setMode] = useState<Mode>('browse');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draw = useDrawing(map, mode !== 'browse');

  const farm = farms.find((f) => f.id === farmId);
  // The store may briefly hold another farm's fields; only show this farm's.
  const fields = useMemo(() => allFields.filter((f) => f.farmId === farmId), [allFields, farmId]);
  const tooLarge = draw.areaHa > PLAN_CONFIG.limits.maxFieldHa;

  useEffect(() => {
    if (!farms.length) loadFarms().catch((e: Error) => setError(e.message));
    loadFields(farmId).catch((e: Error) => setError(e.message));
  }, [farmId, farms.length, loadFarms, loadFields]);

  const onMapReady = useCallback((m: Map) => setMap(m), []);

  async function save(name: string, crop: string) {
    if (!draw.polygon) return;
    const field = await addField(farmId, { name, crop, boundary: draw.polygon });
    setSelectedId(field.id);
    setMode('browse');
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete field "${name}"?`)) return;
    await removeField(id).catch((e: Error) => setError(e.message));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="max-h-[45%] w-full overflow-auto bg-white p-4 md:max-h-none md:w-80">
        <Link to="/app" className="text-sm text-emerald-700">
          ← All farms
        </Link>
        <h1 className="mb-3 text-lg font-bold text-emerald-900">{farm?.name ?? 'Farm'}</h1>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        {mode === 'browse' && (
          <>
            <button
              onClick={() => {
                setSelectedId(null);
                setMode('drawing');
              }}
              className="mb-3 w-full rounded-xl bg-emerald-600 py-2 font-medium text-white"
            >
              + Draw a field
            </button>
            {fields.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Link
                 to={`/app/farms/${farmId}/plan`}
                  className="rounded-xl border border-emerald-600 py-2 text-center font-medium text-emerald-700"
                >
                  Plan a mission
                </Link>
                <Link
                  to={`/app/farms/${farmId}/3d`}
                  className="rounded-xl border border-sky-600 py-2 text-center font-medium text-sky-700"
                >
                  3D farm
                </Link>
              </div>
            )}
            <ul className="space-y-2">
              {fields.map((f) => (
                <li
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={`cursor-pointer rounded-xl border p-3 ${
                    f.id === selectedId ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{f.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(f.id, f.name);
                      }}
                      className="text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    {f.crop} · {f.areaHa.toFixed(2)} ha
                  </div>
                </li>
              ))}
              {fields.length === 0 && (
                <li className="text-sm text-gray-500">
                  No fields yet. Draw your first boundary on the map.
                </li>
              )}
            </ul>
          </>
        )}

        {mode === 'drawing' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Tap the map to place each corner of the field. You need at least 3.
            </p>
            <p className="text-sm font-medium">
              {draw.points.length} corners{draw.polygon && ` · about ${formatHa(draw.areaHa)} ha`}
            </p>
            {tooLarge && (
              <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-sm text-red-800">
                That is over {PLAN_CONFIG.limits.maxFieldHa.toLocaleString('en-US')} ha, which is
                far bigger than a normal field. Zoom the map in closer and draw just the field.
                Fields this large cannot be planned for flight.
              </p>
            )}
            <div className="flex gap-2">
              <button
                disabled={!draw.polygon}
                onClick={() => setMode('naming')}
                className="flex-1 rounded-xl bg-emerald-600 py-2 font-medium text-white disabled:opacity-40"
              >
                Finish
              </button>
              <button
                disabled={!draw.points.length}
                onClick={draw.undo}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:opacity-40"
              >
                Undo
              </button>
              <button
                onClick={() => setMode('browse')}
                className="rounded-xl border border-gray-300 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === 'naming' && (
          <FieldForm areaHa={draw.areaHa} onSave={save} onCancel={() => setMode('drawing')} />
        )}
      </aside>

      <div className="min-h-0 flex-1">
        <FieldMap
          key={farmId}
          fields={fields}
          selectedIds={selectedId ? [selectedId] : []}
          onMapReady={onMapReady}
          onSelect={setSelectedId}
          drawing={mode !== 'browse'}
        />
      </div>
    </div>
  );
}
