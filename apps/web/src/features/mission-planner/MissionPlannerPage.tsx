import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PlanResult } from '@droneverse/shared';
import { api } from '../../lib/api';
import type { LngLat } from '../../map/layers';
import { useFarmStore } from '../../store/useFarmStore';
import { useFleetStore } from '../../store/useFleetStore';
import { FieldMap } from '../farms/FieldMap';
import { DEFAULT_FORM, toRequest, type PlanForm } from './planForm';
import { PlanResults } from './PlanResults';
import { PlanSettings } from './PlanSettings';

export function MissionPlannerPage() {
  const { farmId = '' } = useParams();
  const { farms, fields, loadFarms, loadFields } = useFarmStore();
  const { drones, load: loadDrones } = useFleetStore();
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [pickingHome, setPickingHome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Any change makes the last plan out of date.
  const update = useCallback((patch: Partial<PlanForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setResult(null);
    setError(null);
  }, []);

  const farm = farms.find((f) => f.id === farmId);

  useEffect(() => {
    const fail = (e: Error) => setError(e.message);
    if (!farms.length) loadFarms().catch(fail);
    loadDrones().catch(fail);
  }, []);

  // Load this farm's fields and start with all of them selected.
  useEffect(() => {
    loadFields(farmId)
      .then(() => update({ fieldIds: useFarmStore.getState().fields.map((x) => x.id) }))
      .catch((e: Error) => setError(e.message));
  }, [farmId, loadFields, update]);

  // Default to the first drone once the registry loads.
  useEffect(() => {
    if (drones.length && !form.droneId) setForm((f) => ({ ...f, droneId: drones[0]!.id }));
  }, [drones, form.droneId]);

  const toggleField = useCallback(
    (id: string | null) => {
      if (!id) return;
      update({
        fieldIds: form.fieldIds.includes(id)
          ? form.fieldIds.filter((f) => f !== id)
          : [...form.fieldIds, id],
      });
    },
    [form.fieldIds, update],
  );

  const pickPoint = useCallback(
    (p: LngLat) => {
      update({ home: p });
      setPickingHome(false);
    },
    [update],
  );

  async function generate() {
    const req = toRequest(form);
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.planMission(req));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const plan = useMemo(
    () => ({
      path: (result?.waypoints ?? []).map((w): LngLat => [w.lon, w.lat]),
      home: result ? ([result.home.lon, result.home.lat] as LngLat) : form.home,
    }),
    [result, form.home],
  );

  const ready = form.droneId !== null && form.fieldIds.length > 0;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="max-h-[55%] w-full overflow-auto bg-white p-4 md:max-h-none md:w-[26rem]">
        <Link to={`/farms/${farmId}`} className="text-sm text-emerald-700">
          ← Back to {farm?.name ?? 'farm'}
        </Link>
        <h1 className="mb-4 text-lg font-bold text-emerald-900">Plan a mission</h1>

        {fields.length === 0 ? (
          <p className="text-sm text-gray-600">
            Draw at least one field before planning a mission.
          </p>
        ) : (
          <PlanSettings
            fields={fields}
            drones={drones}
            form={form}
            onChange={update}
            pickingHome={pickingHome}
            onTogglePickHome={() => setPickingHome((p) => !p)}
          />
        )}

        <button
          onClick={generate}
          disabled={!ready || busy}
          className="my-4 w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white disabled:opacity-40"
        >
          {busy ? 'Planning…' : 'Generate plan'}
        </button>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {result && <PlanResults result={result} />}
      </aside>

      <div className="min-h-0 flex-1">
        <FieldMap
          fields={fields}
          selectedIds={form.fieldIds}
          onMapReady={() => {}}
          onSelect={toggleField}
          drawing={false}
          plan={plan}
          onPickPoint={pickingHome ? pickPoint : undefined}
        />
      </div>
    </div>
  );
}
