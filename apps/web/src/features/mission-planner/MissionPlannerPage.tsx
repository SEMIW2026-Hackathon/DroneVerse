import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PLAN_CONFIG, type PlanResult } from '@droneverse/shared';
import { api } from '../../lib/api';
import type { LngLat } from '../../map/layers';
import { useFarmStore } from '../../store/useFarmStore';
import { useFleetStore } from '../../store/useFleetStore';
import { FieldMap } from '../farms/FieldMap';
import { DEFAULT_FORM, toRequest, type PlanForm } from './planForm';
import { PlanResults } from './PlanResults';
import { PlanSettings } from './PlanSettings';

/** Wait this long after the last change before asking the server for a new plan. */
const PLAN_DEBOUNCE_MS = 500;

export function MissionPlannerPage() {
  const { farmId = '' } = useParams();
  const { farms, fields: allFields, loadFarms, loadFields } = useFarmStore();
  const { drones, load: loadDrones } = useFleetStore();
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [pickingHome, setPickingHome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const latestRequest = useRef(0);

  const farm = farms.find((f) => f.id === farmId);
  // The store may briefly hold another farm's fields; only show this farm's.
  const fields = useMemo(() => allFields.filter((f) => f.farmId === farmId), [allFields, farmId]);

  const update = useCallback((patch: Partial<PlanForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  useEffect(() => {
    const fail = (e: Error) => setError(e.message);
    if (!farms.length) loadFarms().catch(fail);
    loadDrones().catch(fail);
    // Load once on mount.
  }, []);

  // Load this farm's fields and start with every plannable one selected.
  useEffect(() => {
    loadFields(farmId)
      .then(() =>
        update({
          fieldIds: useFarmStore
            .getState()
            .fields.filter((f) => f.areaHa <= PLAN_CONFIG.limits.maxFieldHa)
            .map((f) => f.id),
        }),
      )
      .catch((e: Error) => setError(e.message));
  }, [farmId, loadFields, update]);

  // Default to the first drone once the registry loads.
  useEffect(() => {
    if (drones.length && !form.droneId) update({ droneId: drones[0]!.id });
  }, [drones, form.droneId, update]);

  // Plan automatically whenever a field and a drone are selected, and again after any
  // change. The previous plan stays on screen (dimmed) until the new one arrives.
  useEffect(() => {
    const request = toRequest(form);
    if (!request) {
      setResult(null);
      return;
    }
    const id = ++latestRequest.current;
    setBusy(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const plan = await api.planMission(request);
        if (id === latestRequest.current) setResult(plan);
      } catch (err) {
        if (id === latestRequest.current) {
          setResult(null);
          setError((err as Error).message);
        }
      } finally {
        if (id === latestRequest.current) setBusy(false);
      }
    }, PLAN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form, retry]);

  const toggleField = useCallback(
    (id: string | null) => {
      const field = fields.find((f) => f.id === id);
      if (!field || field.areaHa > PLAN_CONFIG.limits.maxFieldHa) return;
      update({
        fieldIds: form.fieldIds.includes(field.id)
          ? form.fieldIds.filter((f) => f !== field.id)
          : [...form.fieldIds, field.id],
      });
    },
    [fields, form.fieldIds, update],
  );

  const pickPoint = useCallback(
    (p: LngLat) => {
      update({ home: p });
      setPickingHome(false);
    },
    [update],
  );

  const plan = useMemo(
    () => ({
      path: (result?.waypoints ?? []).map((w): LngLat => [w.lon, w.lat]),
      home: result ? ([result.home.lon, result.home.lat] as LngLat) : form.home,
    }),
    [result, form.home],
  );

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

        <div className="my-4 min-h-5 text-sm">
          {busy && <span className="text-emerald-700">Planning the flight…</span>}
          {!busy && !result && !error && form.fieldIds.length === 0 && fields.length > 0 && (
            <span className="text-gray-500">Select a field to see the flight path.</span>
          )}
        </div>
        {error && (
          <div className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
            <button onClick={() => setRetry((n) => n + 1)} className="ml-2 underline">
              Try again
            </button>
          </div>
        )}
        {result && (
          <div className={busy ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <PlanResults result={result} />
          </div>
        )}
      </aside>

      <div className="min-h-0 flex-1">
        <FieldMap
          key={farmId}
          fields={fields}
          selectedIds={form.fieldIds}
          fitIds={form.fieldIds}
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
