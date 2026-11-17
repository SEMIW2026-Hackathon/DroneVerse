import { PLAN_CONFIG, type DroneSpec, type Field } from '@droneverse/shared';
import { formatHa } from '../../lib/format';
import { DroneCards } from '../fleet/DroneCards';
import { RANGES, type PlanForm } from './planForm';

interface SliderProps {
  label: string;
  unit: string;
  value: number;
  range: { min: number; max: number; step: number };
  onChange: (v: number) => void;
}

function Slider({ label, unit, value, range, onChange }: SliderProps) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium">
          {value} {unit}
        </span>
      </span>
      <input
        type="range"
        className="w-full accent-emerald-600"
        {...range}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface Props {
  fields: Field[];
  drones: DroneSpec[];
  form: PlanForm;
  onChange: (patch: Partial<PlanForm>) => void;
  pickingHome: boolean;
  onTogglePickHome: () => void;
}

export function PlanSettings({
  fields,
  drones,
  form,
  onChange,
  pickingHome,
  onTogglePickHome,
}: Props) {
  const drone = drones.find((d) => d.id === form.droneId);
  const toggleField = (id: string) =>
    onChange({
      fieldIds: form.fieldIds.includes(id)
        ? form.fieldIds.filter((f) => f !== id)
        : [...form.fieldIds, id],
    });

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 font-semibold text-emerald-900">1. Fields to scan</h2>
        <ul className="space-y-1">
          {fields.map((f) => {
            const tooLarge = f.areaHa > PLAN_CONFIG.limits.maxFieldHa;
            return (
              <li key={f.id}>
                <label
                  className={`flex items-center gap-2 rounded-lg p-1.5 ${
                    tooLarge ? 'opacity-70' : 'cursor-pointer hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-emerald-600"
                    disabled={tooLarge}
                    checked={form.fieldIds.includes(f.id)}
                    onChange={() => toggleField(f.id)}
                  />
                  <span className="flex-1">{f.name}</span>
                  <span className={`text-xs ${tooLarge ? 'text-red-600' : 'text-gray-500'}`}>
                    {formatHa(f.areaHa)} ha
                  </span>
                </label>
                {tooLarge && (
                  <p className="ml-7 text-xs text-red-600">
                    Too large to plan (over {PLAN_CONFIG.limits.maxFieldHa.toLocaleString('en-US')}{' '}
                    ha). It was probably drawn zoomed out. Delete it and redraw it closer.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-emerald-900">2. Choose your drone</h2>
        <DroneCards
          drones={drones}
          layout="list"
          selectedId={form.droneId}
          onSelect={(droneId) => {
            const top = drones.find((d) => d.id === droneId)?.topSpeedKmh ?? form.speedKmh;
            onChange({ droneId, speedKmh: Math.min(form.speedKmh, top) });
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-emerald-900">3. Flight settings</h2>
        <Slider
          label="Altitude"
          unit="m"
          value={form.altitudeM}
          range={RANGES.altitudeM}
          onChange={(altitudeM) => onChange({ altitudeM })}
        />
        <Slider
          label="Overlap along the line"
          unit="%"
          value={form.frontOverlapPct}
          range={RANGES.frontOverlapPct}
          onChange={(frontOverlapPct) => onChange({ frontOverlapPct })}
        />
        <Slider
          label="Overlap between lines"
          unit="%"
          value={form.sideOverlapPct}
          range={RANGES.sideOverlapPct}
          onChange={(sideOverlapPct) => onChange({ sideOverlapPct })}
        />
        <Slider
          label="Speed"
          unit="km/h"
          value={form.speedKmh}
          range={{
            ...RANGES.speedKmh,
            max: Math.min(RANGES.speedKmh.max, drone?.topSpeedKmh ?? RANGES.speedKmh.max),
          }}
          onChange={(speedKmh) => onChange({ speedKmh })}
        />
        <Slider
          label="Expected wind"
          unit="km/h"
          value={form.windKmh}
          range={RANGES.windKmh}
          onChange={(windKmh) => onChange({ windKmh })}
        />
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-emerald-900">4. Launch point</h2>
        <p className="mb-2 text-xs text-gray-600">
          Where the drone takes off and returns to. Closer to the field means less battery used.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onTogglePickHome}
            className={`rounded-xl px-3 py-2 text-sm ${pickingHome ? 'bg-red-600 text-white' : 'border border-gray-300'}`}
          >
            {pickingHome ? 'Tap the map…' : form.home ? 'Move launch point' : 'Set on map'}
          </button>
          {form.home && (
            <button
              type="button"
              onClick={() => onChange({ home: null })}
              className="text-sm text-gray-600"
            >
              Use field corner
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
