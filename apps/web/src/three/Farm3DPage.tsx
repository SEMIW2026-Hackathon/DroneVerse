import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ClientCommand } from '@droneverse/shared';
import { isTelemetryFresh, useTelemetryLink } from '../lib/telemetry';
import { DroneCards } from '../features/fleet/DroneCards';
import { useFarmStore } from '../store/useFarmStore';
import { useFleetStore } from '../store/useFleetStore';
import { FarmScene } from './FarmScene';
import { ManualControls, type ManualInput } from './ManualControls';
import { calculateCoverage } from './coverage';
import { projectFields } from './coordinates';

export function Farm3DPage() {
  const { farmId = '' } = useParams();
  const { farms, fields, loadFarms, loadFields } = useFarmStore();
  const { drones, load: loadDrones } = useFleetStore();
  const [droneId, setDroneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'follow' | 'camera' | 'map'>('camera');
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [visited, setVisited] = useState<{ x: number; z: number }[]>([]);
  const telemetry = useTelemetryLink();
  const currentTelemetry = telemetry.telemetry;
  const telemetryRef = useRef(currentTelemetry);
  telemetryRef.current = currentTelemetry;
  const linkAlive =
    telemetry.state === 'connected' &&
    isTelemetryFresh(telemetry.receivedAt) &&
    currentTelemetry !== null;
  const manualEnabled = linkAlive && currentTelemetry?.mode === 'manual';
  const manualDisabledReason = !linkAlive
    ? 'No signal'
    : (currentTelemetry?.position.altM ?? 0) <= 0.5
      ? 'Take off first'
      : manualEnabled
        ? undefined
        : 'Take manual control first';
  const farm = farms.find((candidate) => candidate.id === farmId);
  const farmFields = useMemo(() => fields.filter((field) => field.farmId === farmId), [fields, farmId]);
  const layout = useMemo(() => projectFields(farmFields), [farmFields]);
  const drone = drones.find((candidate) => candidate.id === droneId) ?? drones[0] ?? null;
  const { sendCommand } = telemetry;
  const coverage = useMemo(
    () => calculateCoverage(layout, visited, Math.max(4, (telemetry.telemetry?.position.altM ?? 20) * 0.15)),
    [layout, telemetry.telemetry, visited],
  );
  const onManualControl = useCallback(
    (control: ManualInput) => {
      if (!linkAlive || !telemetryRef.current?.simulated) return;
      sendCommand('00000000-0000-4000-8000-000000000000', {
        type: 'manualControl',
        ...control,
      });
    },
    [linkAlive, sendCommand],
  );
  const onEnableManual = useCallback(() => {
    if (!linkAlive || telemetry.telemetry?.mode !== 'mission') return;
    sendCommand('00000000-0000-4000-8000-000000000000', { type: 'manualMode' });
  }, [linkAlive, sendCommand, telemetry.telemetry?.mode]);
  const onStopManual = useCallback(() => {
    if (!manualEnabled) return;
    sendCommand('00000000-0000-4000-8000-000000000000', {
      type: 'manualControl',
      forward: 0,
      right: 0,
      vertical: 0,
      yawRate: 0,
      durationMs: 300,
    });
  }, [manualEnabled, sendCommand]);
  const onReturnHome = useCallback(() => {
    if (!linkAlive) return;
    sendCommand('00000000-0000-4000-8000-000000000000', { type: 'returnToHome' });
  }, [linkAlive, sendCommand]);
  const onAbort = useCallback(() => {
    if (!linkAlive) return;
    sendCommand('00000000-0000-4000-8000-000000000000', { type: 'abort' });
  }, [linkAlive, sendCommand]);
  const sendSimSpeed = (multiplier: 1 | 2 | 4) => {
    setSpeed(multiplier);
    if (linkAlive && telemetry.telemetry?.simulated) {
      const command: ClientCommand = {
        type: 'simControl',
        control: { action: 'setSpeed', multiplier },
      };
      telemetry.sendCommand('00000000-0000-4000-8000-000000000000', command);
    }
  };

  useEffect(() => {
    const fail = (reason: Error) => setError(reason.message);
    if (!farms.length) loadFarms().catch(fail);
    loadFields(farmId).catch(fail);
    loadDrones().catch(fail);
  }, [farmId, farms.length, loadDrones, loadFarms, loadFields]);

  useEffect(() => {
    if (!droneId && drones[0]) setDroneId(drones[0].id);
  }, [droneId, drones]);

  useEffect(() => {
    const current = telemetry.telemetry;
    if (!current || (current.mode !== 'mission' && current.mode !== 'manual')) return;
    const point = layout.projectPosition(current.position.lon, current.position.lat);
    setVisited((previous) => {
      const next = [...previous, point];
      return next.length > 1200 ? next.slice(-1200) : next;
    });
  }, [layout, telemetry.telemetry]);

  return (
    <div className="flex h-full flex-col overflow-auto bg-slate-50 p-4 lg:flex-row">
      <aside className="mb-4 w-full shrink-0 rounded-3xl bg-white p-4 shadow-sm lg:mb-0 lg:mr-4 lg:w-80">
        <Link to={`/farms/${farmId}`} className="text-sm text-emerald-700">
          ← Back to {farm?.name ?? 'farm'}
        </Link>
        <h1 className="mt-2 text-xl font-bold text-emerald-950">3D farm view</h1>
        <p className="mb-4 text-sm text-gray-600">
          {farmFields.length} real field{farmFields.length === 1 ? '' : 's'} · procedural digital twin
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <h2 className="mb-2 font-semibold text-emerald-900">Choose your drone</h2>
        <DroneCards
          drones={drones}
          selectedId={drone?.id}
          onSelect={setDroneId}
          layout="list"
        />
        <section className="mt-5 rounded-2xl border border-slate-200 p-3">
          <h2 className="font-semibold text-emerald-900">Mission coverage</h2>
          <div className="mt-2 space-y-3">
            {farmFields.map((field) => {
              const percent = coverage.find((item) => item.fieldId === field.id)?.percent ?? 0;
              return (
                <div key={field.id}>
                  <div className="mb-1 flex justify-between text-xs text-slate-600">
                    <span>{field.name}</span><strong>{percent}%</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {!farmFields.length && <p className="text-xs text-slate-500">No fields loaded.</p>}
          </div>
        </section>
      </aside>
      <main className="relative min-h-[28rem] min-w-0 flex-1">
        <FarmScene
          fields={farmFields}
          drone={drone}
          view={view}
        />
        {view === 'camera' && <CameraViewOverlay sensor={drone?.sensor ?? 'rgb'} />}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className="pointer-events-auto rounded-2xl bg-slate-950/75 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <span className={`h-2 w-2 rounded-full ${linkAlive ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {linkAlive ? (telemetry.telemetry?.simulated ? 'Simulated' : 'Live drone') : 'No signal'}
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-slate-200">
              <span>Battery</span>              <strong>{linkAlive && telemetry.telemetry ? `${telemetry.telemetry.batteryPct.toFixed(0)}%` : '—'}</strong>
              <span>Height</span>              <strong>{linkAlive && telemetry.telemetry ? `${telemetry.telemetry.position.altM.toFixed(1)} m` : '—'}</strong>
              <span>Speed</span>              <strong>{linkAlive && telemetry.telemetry ? `${telemetry.telemetry.speedKmh.toFixed(1)} km/h` : '—'}</strong>
              <span>GPS</span>              <strong>{linkAlive && telemetry.telemetry ? `${telemetry.telemetry.gpsSats} sats` : '—'}</strong>
            </div>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            {(['follow', 'camera', 'map'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-full px-3 py-2 text-xs font-semibold shadow ${
                  view === mode ? 'bg-emerald-700 text-white' : 'bg-white/90 text-slate-700'
                }`}
              >
                {mode[0]!.toUpperCase() + mode.slice(1)}
              </button>
            ))}
            {linkAlive && telemetry.telemetry?.simulated && (
              <div className="flex rounded-full bg-white/90 p-1 shadow">
                {([1, 2, 4] as const).map((multiplier) => (
                  <button
                    key={multiplier}
                    type="button"
                    onClick={() => sendSimSpeed(multiplier)}
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      speed === multiplier ? 'bg-amber-400 text-slate-950' : 'text-slate-700'
                    }`}
                  >
                    {multiplier}x
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pointer-events-auto absolute right-0 top-28">
            <ManualControls
              enabled={manualEnabled && telemetry.telemetry?.simulated === true}
              disabledReason={manualDisabledReason}
              onEnable={onEnableManual}
              onControl={onManualControl}
              onStop={onStopManual}
            />
          </div>
          {linkAlive && (
            <div className="pointer-events-auto absolute right-0 top-[23rem] flex flex-col gap-2">
              <button
                type="button"
                onClick={onReturnHome}
                className="rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow"
              >
                Return to home
              </button>
              <button
                type="button"
                onClick={onAbort}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white shadow"
              >
                Abort
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function CameraViewOverlay({ sensor }: { sensor: 'rgb' | 'multispectral' }) {
  const sensorLabel = sensor === 'multispectral' ? 'THERMAL + MULTISPECTRAL' : 'RGB';
  return (
    <div className="pointer-events-none absolute inset-0 text-white" aria-label="Drone camera overlay">
      <div className="absolute inset-8">
        <span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-white/80" />
        <span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-white/80" />
        <span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-white/80" />
        <span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-white/80" />
        <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
          <span className="absolute inset-2 rounded-full border border-white/80" />
        </div>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-4 text-xs font-semibold tracking-wider text-white/90">
          <span>TILT -32°</span>
          <span>{sensorLabel}</span>
        </div>
      </div>
    </div>
  );
}
